/**
 * RAG embedding core. All OpenAI calls live here, plus the chunkers and
 * primary-row → embedding-text builders. Server-only (uses service-role
 * Supabase client and OPENAI_API_KEY).
 */
import { adminClient } from "@/lib/supabase";
import type { Project, Experience, Education } from "@/lib/types";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const HYDE_MODEL = "gpt-4o-mini";
const HYDE_MAX_TOKENS = 120;

/** Single-shot embed. Throws on non-2xx. */
export async function embedText(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  const v = json.data[0].embedding;
  if (v.length !== EMBED_DIM) throw new Error(`Unexpected embedding dim: ${v.length}`);
  return v;
}

const HYDE_PROMPT = `You generate hypothetical answers to questions about Rithvik Praveen Kumar — a CS + Math student at Purdue University who builds AI and full-stack projects. The hypothetical answer is used purely to improve retrieval (it gets embedded and matched against real content); it does NOT need to be factually accurate. Write 1-2 natural sentences in third-person statement form, as if you were writing a portfolio bio about Rithvik. Output ONLY the answer, no preamble.

Examples:
Q: where did rithvik study?
A: Rithvik studies at Purdue University where he is pursuing a B.S. in Computer Science.

Q: what is boilerframe?
A: Boilerframe is a project Rithvik built that uses AWS technology and computer vision to solve a problem.

Q: what technologies does rithvik use?
A: Rithvik works with React, Next.js, Python, and AWS to build full-stack and AI projects.`;

/** Generates a plausible hypothetical answer to the user's question in the same
 *  statement-form style as the embedded chunks. Used for HyDE (Hypothetical
 *  Document Embeddings) — the hypothetical answer embeds closer to real
 *  content chunks than a bare question does, dramatically improving retrieval
 *  recall on question-form queries. Falls back to the original question on
 *  any failure so an OpenAI hiccup never breaks the chat. */
export async function generateHypotheticalAnswer(question: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return question;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HYDE_MODEL,
        max_tokens: HYDE_MAX_TOKENS,
        messages: [
          { role: "system", content: HYDE_PROMPT },
          { role: "user", content: `Q: ${question}\nA:` },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[rag] hyde failed (${res.status}); falling back to raw question`);
      return question;
    }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const answer = json.choices[0]?.message?.content?.trim();
    return answer || question;
  } catch (e) {
    console.warn("[rag] hyde threw; falling back to raw question:", e instanceof Error ? e.message : e);
    return question;
  }
}

/**
 * Greedy paragraph-aware chunker. Splits on blank lines first, then merges
 * paragraphs until adding the next one would exceed maxChars. Designed for
 * essays / PDFs — primary content rarely needs chunking and bypasses this.
 *
 * 1500 chars is well under text-embedding-3-small's 8191-token input limit
 * but gives enough overlap for paragraph-level semantic search.
 */
export function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (!buf) { buf = p; continue; }
    if (buf.length + 2 + p.length <= maxChars) {
      buf += "\n\n" + p;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : (text.trim() ? [text.slice(0, maxChars)] : []);
}

/** Builds the embed text for a project row as natural prose. Statement-form
 *  text embeds closer to question-form queries than label-prefixed lines do. */
export function buildProjectText(p: Project): string {
  const sentences: string[] = [
    `${p.title} is a project by Rithvik Praveen Kumar. ${p.description}`,
  ];
  if (p.badge) sentences.push(`Category: ${p.badge}.`);
  if (p.tags?.length) sentences.push(`Technologies and tags: ${p.tags.join(", ")}.`);
  if (p.links && Object.keys(p.links).length) {
    const linkList = Object.entries(p.links).map(([k, v]) => `${k}: ${v}`).join("; ");
    sentences.push(`Links — ${linkList}.`);
  }
  return sentences.join(" ");
}

export function buildExperienceText(e: Experience): string {
  const sentences: string[] = [
    `Rithvik Praveen Kumar's role: ${e.role} at ${e.org}.`,
    `This is categorized as ${e.type}, during ${e.date_range}.`,
  ];
  if (e.location) sentences.push(`Location: ${e.location}.`);
  sentences.push(`Details: ${e.description}`);
  if (e.tags?.length) sentences.push(`Related topics: ${e.tags.join(", ")}.`);
  return sentences.join(" ");
}

export function buildEducationText(ed: Education): string {
  const concentrations = ed.concentrations?.length
    ? ` His concentrations are in ${ed.concentrations.join(" and ")}.`
    : "";
  return `Rithvik Praveen Kumar studies at ${ed.school}, where he is pursuing a ${ed.degree}.${concentrations}`;
}

/** Friendly natural-language labels for each site_content key, so the embed
 *  carries a semantic anchor (e.g. "Rithvik's tech stack") rather than an
 *  opaque dotted key ("[bento.stack]"). Falls back to the key string for any
 *  unrecognized entry — adding a new key just means adding a row here. */
const SITE_CONTENT_LABELS: Record<string, string> = {
  "hero.tagline":         "Rithvik's tagline on his portfolio",
  "hero.sub_line":        "Rithvik's intro line on his portfolio",
  "hero.name.line1":      "Rithvik's first name",
  "hero.name.line2":      "Rithvik's last name",
  "bento.location":       "Where Rithvik is located",
  "bento.building":       "What Rithvik is currently building",
  "bento.stats":          "Rithvik's stats — projects, years coding, languages",
  "bento.stack":          "Rithvik's tech stack and technologies he works with",
  "bento.interests":      "Rithvik's interests and topics he is passionate about",
  "contact.headline":     "Contact section headline on Rithvik's portfolio",
  "contact.sub":          "Contact section description on Rithvik's portfolio",
  "contact.link.github":  "Rithvik's GitHub link",
  "contact.link.linkedin": "Rithvik's LinkedIn link",
  "contact.link.email":   "Rithvik's email address",
};

/** Render a site_content key/value pair as natural prose. JSON values are
 *  unwrapped into a comma-joined list so semantic content (stack items,
 *  interests, building description) ends up in the embedded text instead of
 *  being hidden behind JSON braces. */
export function buildSiteContentText(key: string, value: string): string {
  const label = SITE_CONTENT_LABELS[key] ?? `Site content (${key})`;
  let prose: string = value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      prose = parsed
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join(", ");
    } else if (parsed && typeof parsed === "object") {
      prose = Object.entries(parsed as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(". ");
    }
  } catch {
    // value was a plain string already; use it verbatim
  }
  return `${label}: ${prose}`;
}

type PrimaryTable = "projects" | "experience" | "education" | "site_content";

/** Upserts a single primary_embeddings row. Idempotent on (source_table, source_id). */
export async function embedPrimary(
  source_table: PrimaryTable,
  source_id: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const embedding = await embedText(content);
  const { error } = await adminClient()
    .from("primary_embeddings")
    .upsert(
      { source_table, source_id, content, metadata, embedding, updated_at: new Date().toISOString() },
      { onConflict: "source_table,source_id" },
    );
  if (error) throw new Error(`embedPrimary upsert failed: ${error.message}`);
}

/** Removes a primary_embeddings row. Called from deleteProject etc. */
export async function deletePrimary(
  source_table: PrimaryTable,
  source_id: string,
): Promise<void> {
  const { error } = await adminClient()
    .from("primary_embeddings")
    .delete()
    .eq("source_table", source_table)
    .eq("source_id", source_id);
  if (error) throw new Error(`deletePrimary failed: ${error.message}`);
}
