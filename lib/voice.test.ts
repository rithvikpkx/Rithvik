import { test } from "node:test";
import assert from "node:assert/strict";
import { clampRate, durationOk, pickStyle, pickVoice, sniffAudio, speakable, stripPromptEcho } from "./voice.ts";

const bytes = (...n: number[]) => Uint8Array.from([...n, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

test("sniffAudio recognises the four containers by magic bytes", () => {
  assert.equal(sniffAudio(bytes(0x1a, 0x45, 0xdf, 0xa3)), "webm");
  assert.equal(sniffAudio(bytes(...ascii("OggS"))), "ogg");
  assert.equal(sniffAudio(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE"))), "wav");
  assert.equal(sniffAudio(bytes(0, 0, 0, 0x20, ...ascii("ftypisom"))), "mp4");
});

test("sniffAudio rejects non-audio and short input", () => {
  assert.equal(sniffAudio(Uint8Array.from(ascii("<html>not audio"))), null);
  assert.equal(sniffAudio(Uint8Array.from(ascii("RIFF....AVI "))), null);
  assert.equal(sniffAudio(new Uint8Array(0)), null);
});

test("durationOk bounds the claimed length", () => {
  assert.ok(durationOk(2000) && durationOk(25_000));
  for (const bad of [0, -1, 60_000, NaN, Infinity, "5", null, undefined]) assert.equal(durationOk(bad), false);
});

test("speakable strips markdown, links, urls and footnote markers", () => {
  assert.equal(
    speakable("## Hi\n- **Rithvik** built [BoilerFrame](https://x.dev/a) [1] and `code`.\n```js\nx()\n```\nSee https://rithvik.ai now[^2]."),
    "Hi Rithvik built BoilerFrame and code. See now.",
  );
});

test("speakable clips long text at a sentence boundary", () => {
  const s = "First sentence here. ".repeat(100);
  const out = speakable(s, 100);
  assert.ok(out.length <= 100 && out.endsWith("."));
});

test("stripPromptEcho drops a parroted prompt but keeps real speech", () => {
  const p = "Rithvik Praveen Kumar, Purdue, BoilerFrame";
  assert.equal(stripPromptEcho("Rithvik Praveen Kumar, Purdue, BoilerFrame.", p), "");
  assert.equal(stripPromptEcho("Tell me about BoilerFrame", p), "Tell me about BoilerFrame");
});

test("voice prefs from the client are allow-listed and clamped", () => {
  assert.equal(pickVoice("coral"), "coral");
  assert.equal(pickVoice("evil\"voice"), "marin");
  assert.equal(pickStyle("radio"), "radio");
  assert.equal(pickStyle("constructor"), "natural");
  assert.equal(clampRate(9), 1.75);
  assert.equal(clampRate("fast"), 1);
});
