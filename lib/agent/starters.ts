/** Instant answers for the welcome chips: built from Content at call time (never stored text), so a
 *  content edit changes the answer with no code change. Pure; no model, no network. */
import type { Content } from "@/lib/content/types";

/** The chip questions, in display order. */
export const STARTER_QUESTIONS = ["What has he built?", "Where does he study?", "Is he open to internships?", "How do I reach him?"];

/** Lowercase and strip punctuation so a chip's text matches however it is typed. */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

/** The answer (Markdown) for a starter question, or null when `q` is not one of them. */
export function starterAnswer(c: Content, q: string): string | null {
  switch (norm(q)) {
    case norm(STARTER_QUESTIONS[0]):
      return `${c.first} has built ${c.projects.length} project${c.projects.length === 1 ? "" : "s"}:\n\n${c.projects.map((p) => `- **${p.title}**: ${p.headline}`).join("\n")}`;
    case norm(STARTER_QUESTIONS[1]): {
      const e = c.education;
      return `${c.first} studies ${e.degree} at ${e.school}${e.focus ? `, with a focus on ${e.focus}` : ""}.`;
    }
    case norm(STARTER_QUESTIONS[2]):
      return `${c.status}.`;
    case norm(STARTER_QUESTIONS[3]): {
      const l = c.links;
      return `Email is best: [${l.email}](mailto:${l.email}). He is also on [GitHub](${l.github}) and [LinkedIn](${l.linkedin}).`;
    }
    default:
      return null;
  }
}
