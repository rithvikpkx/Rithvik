import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveActions,
  normalizeActions,
  safeUrl,
  ACTION_SIMILARITY_FLOOR,
  MAX_ACTIONS,
  isDeclineAnswer,
  type PrimaryChunkMeta,
  type ActionLinkSources,
} from "./chat-actions.ts";

const LINKS: ActionLinkSources = {
  projectLinks: {
    boilerframe: { github: "https://github.com/rithvikpkx/BoilerFrame" },
    "citizen-happiness": {
      github: "https://github.com/rithvikpkx/HappinessProjectSHAPE",
      demo: "https://www.youtube.com/watch?v=eBzE83IjDZM",
    },
    "no-links": {},
    hostile: { github: "javascript:alert(1)" },
  },
  experienceUrls: { "code-ninjas-ir": "https://codeninjas.com" },
  educationUrls: { "Purdue University": "https://purdue.edu" },
};

const chunk = (
  source_table: string,
  metadata: Record<string, unknown>,
  similarity = 0.6,
): PrimaryChunkMeta => ({ source_table, source_id: "x", metadata, similarity });

const NEUTRAL = "tell me about that";

test("a project yields its link plus a scroll to that specific card", () => {
  const a = deriveActions([chunk("projects", { slug: "boilerframe", title: "BoilerFrame" })], LINKS, NEUTRAL, 0.7);
  assert.deepEqual(a[0], {
    type: "open_link",
    label: "View on GitHub",
    url: "https://github.com/rithvikpkx/BoilerFrame",
  });
  assert.ok(a.some((x) => x.type === "scroll_to" && x.target === "project-boilerframe"));
});

test("a project with no links still offers the scroll", () => {
  const a = deriveActions([chunk("projects", { slug: "no-links", title: "Thing" })], LINKS, NEUTRAL, 0.7);
  assert.equal(a.length, 1);
  assert.equal(a[0].type, "scroll_to");
});

test("a javascript: URL in the database is dropped", () => {
  const a = deriveActions([chunk("projects", { slug: "hostile", title: "Hostile" })], LINKS, NEUTRAL, 0.7);
  assert.ok(!a.some((x) => x.type === "open_link"));
});

test("experience maps to its org link and its own anchor", () => {
  const a = deriveActions([chunk("experience", { slug: "code-ninjas-ir", org: "Code Ninjas" })], LINKS, NEUTRAL, 0.7);
  assert.ok(a.some((x) => x.type === "open_link" && x.url === "https://codeninjas.com/"));
  assert.ok(a.some((x) => x.type === "scroll_to" && x.target === "experience-code-ninjas-ir"));
});

test("education maps to the education anchor", () => {
  const a = deriveActions([chunk("education", { school: "Purdue University" })], LINKS, NEUTRAL, 0.7);
  assert.ok(a.some((x) => x.type === "scroll_to" && x.target === "education"));
});

test("site_content keys map to their sections", () => {
  const bento = deriveActions([chunk("site_content", { key: "bento.building" })], LINKS, NEUTRAL, 0.7);
  assert.ok(bento.some((x) => x.type === "scroll_to" && x.target === "bento"));
  const hero = deriveActions([chunk("site_content", { key: "hero.tagline" })], LINKS, NEUTRAL, 0.7);
  assert.ok(hero.some((x) => x.type === "scroll_to" && x.target === "about"));
});

test("a contact chunk offers the composer", () => {
  const a = deriveActions([chunk("site_content", { key: "contact.link.email" })], LINKS, NEUTRAL, 0.7);
  assert.ok(a.some((x) => x.type === "open_composer"));
});

test("contact intent offers the composer even when retrieval points elsewhere", () => {
  const a = deriveActions(
    [chunk("projects", { slug: "boilerframe", title: "BoilerFrame" })],
    LINKS,
    "how can I get in touch with him?",
    0.7,
  );
  assert.ok(a.some((x) => x.type === "open_composer"));
});

test("no actions below the relevance floor", () => {
  const weak = ACTION_SIMILARITY_FLOOR - 0.01;
  const a = deriveActions([chunk("projects", { slug: "boilerframe", title: "B" })], LINKS, NEUTRAL, weak);
  assert.deepEqual(a, []);
});

test("the relevance gate is independent of the target chunk's own score", () => {
  // A strong target chunk must NOT rescue an off-topic question: the gate comes
  // from the bare-question retrieval, the target from the HyDE one.
  const a = deriveActions([chunk("projects", { slug: "boilerframe", title: "B" }, 0.99)], LINKS, NEUTRAL, 0.1);
  assert.deepEqual(a, []);
});

test("no chunks yields no actions", () => {
  assert.deepEqual(deriveActions([], LINKS, NEUTRAL, 0.7), []);
});

test("never exceeds the cap, and links outrank scrolls", () => {
  const a = deriveActions(
    [chunk("projects", { slug: "citizen-happiness", title: "Citizen Happiness" })],
    LINKS,
    NEUTRAL,
    0.7,
  );
  assert.equal(a.length, MAX_ACTIONS);
  assert.ok(a.every((x) => x.type === "open_link"), "both links should win over the scroll");
});

test("only the top-ranked chunk is used", () => {
  const a = deriveActions(
    [
      chunk("education", { school: "Purdue University" }, 0.9),
      chunk("projects", { slug: "boilerframe", title: "BoilerFrame" }, 0.8),
    ],
    LINKS,
    NEUTRAL,
    0.7,
  );
  assert.ok(!a.some((x) => x.type === "scroll_to" && x.target.startsWith("project-")));
});

test("missing/!null metadata never throws", () => {
  assert.doesNotThrow(() =>
    deriveActions([{ source_table: "projects", source_id: "x", metadata: null, similarity: 0.9 }], LINKS, NEUTRAL, 0.7),
  );
});

// ── safeUrl / normalizeActions ──────────────────────────────────────────────

test("safeUrl returns the canonical form, not the raw input", () => {
  // Documented surprise: a bare origin gains a trailing slash.
  assert.equal(safeUrl("https://codeninjas.com"), "https://codeninjas.com/");
  assert.equal(safeUrl("  https://a.com/x  "), "https://a.com/x");
});

test("safeUrl accepts http(s) and rejects everything else", () => {
  assert.ok(safeUrl("https://example.com"));
  assert.ok(safeUrl("http://example.com"));
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html;base64,x"), null);
  assert.equal(safeUrl("mailto:a@b.com"), null);
  assert.equal(safeUrl("not a url"), null);
  assert.equal(safeUrl(""), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl(42), null);
});

test("normalizeActions rejects malformed payloads", () => {
  assert.deepEqual(normalizeActions(null), []);
  assert.deepEqual(normalizeActions("nope"), []);
  assert.deepEqual(normalizeActions([{ type: "open_link", label: "x" }]), []); // no url
  assert.deepEqual(normalizeActions([{ type: "made_up", label: "x" }]), []);
  assert.deepEqual(normalizeActions([{ type: "open_link", label: "", url: "https://a.com" }]), []);
});

test("normalizeActions rejects a scroll target that isn't a bare element id", () => {
  assert.deepEqual(normalizeActions([{ type: "scroll_to", label: "go", target: "#a .b" }]), []);
  assert.deepEqual(normalizeActions([{ type: "scroll_to", label: "go", target: "body > *" }]), []);
  assert.equal(normalizeActions([{ type: "scroll_to", label: "go", target: "project-x" }]).length, 1);
});

test("normalizeActions strips a hostile url from an otherwise valid action", () => {
  assert.deepEqual(normalizeActions([{ type: "open_link", label: "click", url: "javascript:alert(1)" }]), []);
});

test("normalizeActions enforces the cap", () => {
  const many = Array.from({ length: 6 }, () => ({ type: "open_composer", label: "Email" }));
  assert.equal(normalizeActions(many).length, MAX_ACTIONS);
});

// ── decline detection ───────────────────────────────────────────────────────

test("isDeclineAnswer catches the canned refusal and the off-topic redirect", () => {
  assert.ok(isDeclineAnswer("I don't have that specific detail, but you're welcome to reach out."));
  assert.ok(isDeclineAnswer("I'm here specifically to answer questions about Rithvik — what would you like to know?"));
  assert.ok(isDeclineAnswer("I'm only set up to discuss Rithvik and his portfolio."));
});

test("isDeclineAnswer is case-insensitive", () => {
  assert.ok(isDeclineAnswer("I DON'T HAVE THAT SPECIFIC DETAIL."));
});

test("isDeclineAnswer leaves real answers alone", () => {
  assert.ok(!isDeclineAnswer("Rithvik studies at Purdue University, pursuing a B.S. in Computer Science."));
  assert.ok(!isDeclineAnswer("BoilerFrame is a facial-scan tool he built."));
});
