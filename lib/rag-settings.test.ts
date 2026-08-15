import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampTemperature,
  TEMP_MIN,
  TEMP_MAX,
  TEMP_DEFAULT,
  RAG_SETTING_PREFIX,
  TEMPERATURE_KEY,
} from "./rag-settings.ts";

test("passes through values inside the range", () => {
  assert.equal(clampTemperature(0.9), 0.9);
  assert.equal(clampTemperature(TEMP_MIN), TEMP_MIN);
  assert.equal(clampTemperature(TEMP_MAX), TEMP_MAX);
});

test("clamps out-of-range values to the guard rails", () => {
  assert.equal(clampTemperature(5), TEMP_MAX);
  assert.equal(clampTemperature(-3), TEMP_MIN);
});

test("accepts the string form the DB stores", () => {
  assert.equal(clampTemperature("0.85"), 0.85);
});

test("falls back to the default for unparseable input", () => {
  for (const bad of [undefined, null, "", "hot", NaN, {}, []]) {
    assert.equal(clampTemperature(bad), TEMP_DEFAULT, `expected default for ${JSON.stringify(bad)}`);
  }
});

test("infinities do not slip past the finite check", () => {
  assert.equal(clampTemperature(Infinity), TEMP_DEFAULT);
  assert.equal(clampTemperature(-Infinity), TEMP_DEFAULT);
});

test("the temperature key sits under the never-embedded prefix", () => {
  // If this ever drifts, backfillPrimaryEmbeddings would start embedding the
  // bot's own settings as facts about Rithvik.
  assert.ok(TEMPERATURE_KEY.startsWith(RAG_SETTING_PREFIX));
});
