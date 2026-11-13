/**
 * Derives the small set of things the RAG bot can *do* on a given turn:
 * open a relevant link, point at a section of the page, or open the email
 * composer.
 *
 * Entirely deterministic. `match_primary` already returns `source_table`,
 * `source_id`, `metadata` and `similarity`, which is enough to know which
 * record the answer drew on — so "which section?" and "which link?" are
 * answered by retrieval, before any model is involved. No tool calling, no
 * extra API call, no hallucination surface.
 *
 * SECURITY: the model never supplies a URL. Actions name a record; the caller
 * passes in URLs read from the database, and `safeUrl()` drops anything that
 * isn't a plain http(s) address. A model-authored URL rendered as a clickable
 * button would be a phishing vector, and secondary documents are a
 * prompt-injection surface.
 *
 * Pure and dependency-free so it unit-tests with node:test.
 */

export type ChatAction =
  | { type: "open_link"; label: string; url: string }
  | { type: "scroll_to"; label: string; target: string }
  | { type: "open_composer"; label: string };

/** A retrieved primary chunk, narrowed to the fields actions need.
 *  All optional: this is RPC data, and a missing column should degrade to
 *  "no actions" rather than throw. */
export interface PrimaryChunkMeta {
  source_table?: string;
  source_id?: string;
  metadata?: Record<string, unknown> | null;
  similarity?: number;
}

/** URLs the site itself knows about, keyed by record. Built server-side from
 *  the database — never from model output. */
export interface ActionLinkSources {
  /** project slug -> its `links` object (github, demo, …) */
  projectLinks: Record<string, Record<string, string>>;
  /** experience slug -> org_url */
  experienceUrls: Record<string, string>;
  /** school name -> school_url */
  educationUrls: Record<string, string>;
}

/**
 * Below this cosine similarity the top chunk isn't a confident enough match to
 * hang a button off. A button pointing somewhere unhelpful is worse than no
 * button — the same reasoning as the suggestion gates.
 *
 * CRITICAL: this must be measured against an embedding of the BARE QUESTION,
 * never the question+HyDE embedding the answer retrieval uses. Measured on the
 * live corpus:
 *
 *            bare question        question + HyDE
 *   on-topic   0.619 – 0.789        0.661 – 0.876
 *   off-topic  0.099 – 0.191        0.354 – 0.732   <- overlaps
 *
 * HyDE writes a Rithvik-flavoured hypothetical even for "who won the world
 * cup?", which drags the embedding into the corpus — that question scores 0.732
 * with HyDE, higher than a real question about a project. Great for recall,
 * useless as a relevance signal. On the bare question the two bands are cleanly
 * separated and 0.45 sits comfortably between them.
 */
export const ACTION_SIMILARITY_FLOOR = 0.45;

/** Phrases the bot uses when it declines or redirects. If the answer is one of
 *  these, there is nothing to point at, so no actions are offered. */
const DECLINE_MARKERS = [
  "i don't have that specific detail",
  "i'm here specifically to answer questions about rithvik",
  "i'm only set up to discuss rithvik",
];

/** True when the answer was a refusal or an off-topic redirect. */
export function isDeclineAnswer(answer: string): boolean {
  const a = answer.toLowerCase();
  return DECLINE_MARKERS.some((m) => a.includes(m));
}

/** At most this many buttons, so the action row can't crowd out the chips. */
export const MAX_ACTIONS = 2;

/** Questions that should offer the composer regardless of what was retrieved. */
const CONTACT_INTENT = /\b(email|e-mail|contact|reach|reach out|hire|hiring|get in touch|message him|talk to)\b/i;

/** Nice labels for the link keys projects actually use. */
const LINK_LABELS: Record<string, string> = {
  github: "View on GitHub",
  demo: "Watch the demo",
  site: "Visit the site",
  live: "Visit the site",
  paper: "Read the paper",
};

/** Accepts only plain web links. Blocks javascript:, data:, mailto: and any
 *  malformed value that might have reached the DB.
 *
 *  Returns the CANONICAL form, not the input: `new URL().toString()` normalises
 *  (notably adding a trailing slash to a bare origin), which is deliberate —
 *  canonicalising also neutralises obfuscated spellings of a host. */
export function safeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Builds the action list for a turn from the retrieved chunks.
 *
 * Only the single best-matching chunk is considered: actions should reinforce
 * what the answer was actually about, and mixing sources produces buttons that
 * feel arbitrary.
 */
export function deriveActions(
  chunks: PrimaryChunkMeta[],
  links: ActionLinkSources,
  question: string,
  relevanceScore: number,
): ChatAction[] {
  const actions: ChatAction[] = [];
  const contactWanted = CONTACT_INTENT.test(question);

  // Two different signals, on purpose:
  //  - `relevanceScore` (bare-question retrieval) decides WHETHER to act. It is
  //    the only one that separates on-topic from off-topic.
  //  - `chunks` (the same HyDE retrieval the answer used) decides WHAT to point
  //    at, so the button matches what the answer actually talked about.
  if (relevanceScore < ACTION_SIMILARITY_FLOOR) return [];

  const top = chunks[0];

  if (top) {
    const meta = top.metadata ?? {};
    const slug = str(meta.slug);

    if (top.source_table === "projects" && slug) {
      const projectLinks = links.projectLinks[slug] ?? {};
      for (const [key, value] of Object.entries(projectLinks)) {
        const url = safeUrl(value);
        if (!url) continue;
        actions.push({ type: "open_link", label: LINK_LABELS[key] ?? `Open ${key}`, url });
      }
      actions.push({
        type: "scroll_to",
        label: `Show ${str(meta.title) ?? "it"} on the page`,
        target: `project-${slug}`,
      });
    } else if (top.source_table === "experience" && slug) {
      const url = safeUrl(links.experienceUrls[slug]);
      if (url) actions.push({ type: "open_link", label: `Visit ${str(meta.org) ?? "site"}`, url });
      actions.push({ type: "scroll_to", label: "Show me on the page", target: `experience-${slug}` });
    } else if (top.source_table === "education") {
      const school = str(meta.school);
      const url = school ? safeUrl(links.educationUrls[school]) : null;
      if (url) actions.push({ type: "open_link", label: `Visit ${school}`, url });
      actions.push({ type: "scroll_to", label: "Show me on the page", target: "education" });
    } else if (top.source_table === "site_content") {
      const key = str(meta.key) ?? "";
      if (key.startsWith("contact.")) {
        actions.push({ type: "open_composer", label: "Email Rithvik" });
      } else if (key.startsWith("bento.")) {
        actions.push({ type: "scroll_to", label: "Show me on the page", target: "bento" });
      } else if (key.startsWith("hero.")) {
        actions.push({ type: "scroll_to", label: "Show me on the page", target: "about" });
      }
    }
  }

  // Contact intent wins a slot even when retrieval pointed elsewhere — someone
  // asking how to reach him wants the composer, not a project link.
  if (contactWanted && !actions.some((a) => a.type === "open_composer")) {
    actions.unshift({ type: "open_composer", label: "Email Rithvik" });
  }

  // link > composer > scroll, so the most concrete option survives the cap.
  const rank = (a: ChatAction) => (a.type === "open_link" ? 0 : a.type === "open_composer" ? 1 : 2);
  return actions.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_ACTIONS);
}

/** Client-side guard: the panel trusts the payload no more than the server
 *  trusts the model. Mirrors normalizeSuggestions. */
export function normalizeActions(raw: unknown): ChatAction[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { type, label } = item as { type?: unknown; label?: unknown };
    const l = str(label);
    if (!l) continue;
    if (type === "open_link") {
      const url = safeUrl((item as { url?: unknown }).url);
      if (url) out.push({ type: "open_link", label: l, url });
    } else if (type === "scroll_to") {
      const target = str((item as { target?: unknown }).target);
      // Element ids only — never a selector, so this can't be used to reach
      // arbitrary parts of the document.
      if (target && /^[a-zA-Z0-9_-]+$/.test(target)) {
        out.push({ type: "scroll_to", label: l, target });
      }
    } else if (type === "open_composer") {
      out.push({ type: "open_composer", label: l });
    }
    if (out.length === MAX_ACTIONS) break;
  }
  return out;
}
