import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../content/fixture.ts";
import { STARTER_QUESTIONS, starterAnswer } from "./starters.ts";

test("every starter answers from content and mentions real facts", () => {
  for (const q of STARTER_QUESTIONS) assert.ok(starterAnswer(fixture, q), q);
  const built = starterAnswer(fixture, "What has he built?")!;
  for (const p of fixture.projects) assert.ok(built.includes(p.title), p.title);
  assert.match(starterAnswer(fixture, "where does he study")!, /Purdue University/);
  assert.match(starterAnswer(fixture, "Is he open to internships?")!, /internships/);
  assert.ok(starterAnswer(fixture, "How do I reach him?")!.includes(fixture.links.email));
});

test("answers track content edits and never invent a graduation date", () => {
  const edited = { ...fixture, projects: fixture.projects.slice(0, 1), education: { ...fixture.education, school: "MIT", focus: "" } };
  assert.match(starterAnswer(edited, "What has he built?")!, /built 1 project:/);
  const study = starterAnswer(edited, "Where does he study?")!;
  assert.match(study, /MIT/);
  assert.doesNotMatch(study, /focus|graduat|20\d\d/i);
});

test("non-starters return null", () => {
  assert.equal(starterAnswer(fixture, "Tell me a joke"), null);
  assert.equal(starterAnswer(fixture, ""), null);
});
