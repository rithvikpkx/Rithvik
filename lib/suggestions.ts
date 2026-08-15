/**
 * Generates grounded follow-up questions for the RAG chat. Server-only — the
 * wire format lives in lib/suggestion-protocol.ts so the client can parse the
 * stream without pulling any of this in.
 *
 * A failure here must never touch the answer stream: every path returns an
 * array, never throws.
 *
 * ── Why this is more than one LLM call ──────────────────────────────────────
 * A suggestion is generated against the context retrieved for the CURRENT
 * question (C1), but when the visitor clicks it the route runs a FRESH
 * retrieval for that new question (C2). "Answerable from C1" does not imply
 * "answerable from C2", and the model also likes to invent plausible-adjacent
 * questions ("how does he balance studies and projects?") that nothing in the
 * corpus actually answers. Both produce the canned refusal, which is a worse
 * experience than showing no suggestion at all.
 *
 * So each candidate passes two gates:
 *   1. EVIDENCE  — the model must quote the sentence in C1 that answers it, and
 *                  that quote must really appear in C1. Kills inventions.
 *   2. RETRIEVAL — embed the candidate and run the same match_* lookup the
 *                  answer will run, then confirm the evidence comes back in C2.
 *                  Kills the C1/C2 mismatch.
 * Both gates are deterministic string checks; no extra judge model.
 */
import { adminClient } from "@/lib/supabase";
import { embedTexts } from "@/lib/embeddings";
import {
  normalizeSuggestions,
  containsGrounding,
  isRedundant,
  cosineSimilarity,
  REDUNDANT_COSINE,
  MAX_SUGGESTION_CHARS,
  WANTED_SUGGESTIONS,
} from "@/lib/suggestion-protocol";

export { SUGGESTIONS_SENTINEL } from "@/lib/suggestion-protocol";

const MODEL = "gpt-4o-mini";
/** Kept tight on purpose. Each candidate costs a question AND a verbatim quote,
 *  and this call has to finish inside the answer's streaming window (~2.5s) to
 *  stay free. At 8 candidates with long quotes the turn went 2.4s -> 6.3s. */
const MAX_TOKENS = 340;
/** Enough slack for the gates to reject a couple without leaving us short. */
const CANDIDATES = 6;
/** Quotes long enough to be verifiable, short enough to generate fast. */
const EVIDENCE_MAX_WORDS = 15;
/** Chunks pulled per store when simulating the answer's retrieval. Mirrors the
 *  route's MATCH_COUNT_PER_SOURCE so the simulation matches reality. */
const VERIFY_MATCH_COUNT = 10;

const SYSTEM_PROMPT = `You generate follow-up questions a VISITOR might ask next on Rithvik Praveen Kumar's portfolio chatbot.

You will be given Context: excerpts from Rithvik's website and background materials.

For each question you propose, you MUST first locate the exact sentence in the Context that answers it, and quote that sentence verbatim as "evidence". If you cannot find a sentence in the Context that directly answers a question, DO NOT propose that question. There is no partial credit: a question whose answer is merely implied, adjacent, or plausible is a FAILURE.

Bad (do not do this): the Context mentions his studies and his projects, so you propose "How does Rithvik balance his studies and projects?" — nothing in the Context states how he balances them.
Good: the Context says "Rithvik volunteered with Habitat for Humanity developing software to streamline their e-commerce operations", so you propose "What did Rithvik build for Habitat for Humanity?" with that sentence as evidence.

Rules:
- Propose up to ${CANDIDATES} questions, ordered best first.
- Each question: at most ${MAX_SUGGESTION_CHARS} characters, in the visitor's voice, about Rithvik in the third person.
- "evidence" must be copied verbatim from the Context: between 8 and ${EVIDENCE_MAX_WORDS} words. Quote the single most relevant span, not a whole paragraph.
- Never restate the current question or ask something it already answers.
- No numbering, no surrounding quotes, no commentary.

Respond with JSON:
{"suggestions": [{"question": "...", "evidence": "..."}]}`;

interface Candidate { question: string; evidence: string }

/** Pulls well-formed {question, evidence} pairs out of the model's JSON. */
function parseCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return [];
  const out: Candidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { question, evidence } = item as { question?: unknown; evidence?: unknown };
    if (typeof question !== "string" || typeof evidence !== "string") continue;
    const q = question.trim().replace(/\s+/g, " ");
    const e = evidence.trim();
    if (!q || !e) continue;
    out.push({ question: q, evidence: e });
  }
  return out;
}

/**
 * Gate 2. Embeds every surviving candidate in ONE batched call, runs the same
 * match_primary/match_secondary lookup the answer will run, and keeps only the
 * candidates whose supporting evidence actually comes back.
 *
 * The answer path embeds question+HyDE rather than the bare question; using the
 * bare question here is a conservative approximation, since HyDE generally
 * improves recall — if the plain question already surfaces the evidence, the
 * HyDE-augmented lookup almost certainly will too.
 */
async function keepRetrievable(
  candidates: Candidate[],
  vectors: number[][],
): Promise<string[]> {
  if (candidates.length === 0) return [];
  const db = adminClient();

  const checks = await Promise.allSettled(
    candidates.map(async (c, i) => {
      const [p, s] = await Promise.allSettled([
        db.rpc("match_primary", { query_embedding: vectors[i], match_count: VERIFY_MATCH_COUNT }),
        db.rpc("match_secondary", { query_embedding: vectors[i], match_count: VERIFY_MATCH_COUNT }),
      ]);
      const rows = [p, s].flatMap((r) =>
        r.status === "fulfilled" && !r.value.error
          ? ((r.value.data as { content: string }[] | null) ?? [])
          : [],
      );
      const retrieved = rows.map((r) => r.content).join("\n\n");
      return containsGrounding(retrieved, c.evidence) ? c.question : null;
    }),
  );

  return checks
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((q): q is string => q !== null);
}

/**
 * Asks for follow-ups grounded in the same context the answer is drawn from,
 * then verifies them. Start this in PARALLEL with the main completion and await
 * it once the answer has streamed.
 *
 * Returns [] on any failure. Callers treat an empty array as "show nothing" —
 * fewer suggestions is always better than one that dead-ends.
 */
export async function generateSuggestions(
  question: string,
  contextBlock: string,
  askedQuestions: string[] = [],
  answerJustGiven = "",
  recentlyOffered: string[] = [],
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  if (!contextBlock.trim()) return [];   // nothing grounded to suggest from

  // Everything the visitor has already asked, current turn included.
  const asked = [question, ...askedQuestions].filter((q) => q.trim().length > 0);
  // Chips shown in the last couple of turns. Without this the same three
  // questions get re-offered every turn — two consecutive turns produced
  // byte-identical chip rows — which makes the bot feel stuck in a loop.
  const offered = recentlyOffered.filter((q) => q.trim().length > 0);
  // One list for the gates; the prompt distinguishes them for clarity.
  const avoid = [...asked, ...offered];
  const askedBlock = asked.map((q) => `- ${q}`).join("\n");
  const offeredBlock = offered.length
    ? `\n\nAlready offered as suggestions recently — pick different angles:\n` +
      offered.map((q) => `- ${q}`).join("\n")
    : "";
  // The answer is the single best signal for "don't suggest this" — most of the
  // observed repeats were questions the answer had already fully covered.
  const answerBlock = answerJustGiven.trim()
    ? `\n\nThe answer the visitor just received (do NOT propose anything this ` +
      `already covers):\n${answerJustGiven.trim().slice(0, 2000)}`
    : "";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Low: this is an extraction task against the Context, not a creative
        // one. Higher temperature is exactly what produced invented questions.
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `Already asked in this conversation — do NOT propose any of these, ` +
              `or a reworded version of them:\n${askedBlock}` +
              offeredBlock +
              answerBlock +
              `\n\nContext:\n${contextBlock}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[rag] suggestions failed (${res.status}); continuing without them`);
      return [];
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { suggestions?: unknown };
    const candidates = parseCandidates(parsed.suggestions);
    if (candidates.length === 0) return [];

    // Gate 0a: cheap lexical repeat check, no network.
    const lexFresh = candidates.filter((c) => !isRedundant(c.question, avoid));

    // Gate 1: the quoted evidence must really be in the context we gave it.
    // Runs before the embedding call so we never pay to embed a candidate that
    // is already disqualified.
    const grounded = lexFresh.filter((c) => containsGrounding(contextBlock, c.evidence));
    if (grounded.length === 0) {
      console.log(`[rag] suggestions: ${candidates.length} proposed -> 0 survived lexical/grounding gates`);
      return [];
    }

    // ONE embedding call covers both remaining gates: candidate vectors are
    // reused for the retrieval simulation, and the asked-question vectors let
    // us catch semantic rewordings that share no vocabulary.
    const all = await embedTexts([...grounded.map((c) => c.question), ...avoid]);
    const candidateVecs = all.slice(0, grounded.length);
    const askedVecs = all.slice(grounded.length);

    // Gate 0b: semantically the same question as one already asked.
    const semFresh: Candidate[] = [];
    const semVecs: number[][] = [];
    grounded.forEach((c, i) => {
      const worst = askedVecs.reduce((m, v) => Math.max(m, cosineSimilarity(candidateVecs[i], v)), 0);
      if (worst < REDUNDANT_COSINE) {
        semFresh.push(c);
        semVecs.push(candidateVecs[i]);
      }
    });

    // Gate 2: the evidence must survive a fresh retrieval for that question.
    const retrievable = await keepRetrievable(semFresh, semVecs);

    const final = normalizeSuggestions(retrievable);
    console.log(
      `[rag] suggestions: ${candidates.length} proposed -> ${lexFresh.length} lex-fresh -> ` +
        `${grounded.length} grounded -> ${semFresh.length} sem-fresh -> ${retrievable.length} retrievable -> ${final.length} shown`,
    );
    return final;
  } catch (e) {
    console.warn("[rag] suggestions threw; continuing without them:", e instanceof Error ? e.message : e);
    return [];
  }
}

export { WANTED_SUGGESTIONS };
