import { test } from "node:test";
import assert from "node:assert/strict";
import { maskSecret } from "./replay.ts";

const el = (o: { type?: string; autocomplete?: string; inMasked?: boolean }) =>
  ({ type: o.type ?? "text", autocomplete: o.autocomplete ?? "", closest: () => (o.inMasked ? {} : null) }) as unknown as HTMLElement;

test("maskSecret: typed text is kept, only security fields are starred", () => {
  assert.equal(maskSecret("hello there", el({})), "hello there");
  assert.equal(maskSecret("me@acme.example", el({ type: "email" })), "me@acme.example");
  assert.equal(maskSecret("12345678", el({ autocomplete: "one-time-code" })), "********");
  assert.equal(maskSecret("hunter2", el({ type: "password" })), "*******");
  assert.equal(maskSecret("me@x.example", el({ inMasked: true })), "************"); // data-rr-mask / .rr-block ancestor
  assert.equal(maskSecret("x", null), "x");
});
