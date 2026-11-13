/** Instant starter-chip answers for the transcript. useAgent.submit calls this before it would hit
 *  /api/chat (see the one-line hook in the stream notes); the answer text comes from lib/agent/starters.ts. */
import type { Content } from "@/lib/content/types";
import { starterAnswer } from "@/lib/agent/starters";
import type { NewItem } from "./types";

/** If `q` is a starter question, appends its Search row + finished answer and returns true (no API call).
 *  `record` stores the exchange so follow-ups still see it as history. */
export function answerStarter(q: string, content: Content, add: (item: NewItem) => void, record: (answer: string) => void): boolean {
  const a = starterAnswer(content, q);
  if (a === null) return false;
  add({ kind: "tool", name: "Search", args: `site, "${q}"`, result: "answered from site content" });
  add({ kind: "answer", text: a, streaming: false });
  record(a);
  return true;
}
