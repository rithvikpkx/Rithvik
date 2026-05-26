import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml, htmlToText } from "./sanitize-html.ts";

test("keeps allowlisted formatting tags", () => {
  assert.equal(sanitizeEmailHtml("<b>hi</b> <i>there</i>"), "<b>hi</b> <i>there</i>");
});

test("keeps lists", () => {
  assert.equal(sanitizeEmailHtml("<ul><li>a</li><li>b</li></ul>"), "<ul><li>a</li><li>b</li></ul>");
});

test("drops script blocks and their contents", () => {
  assert.equal(sanitizeEmailHtml("a<script>alert(1)</script>b"), "ab");
});

test("strips event-handler and style attributes by reconstructing tags", () => {
  assert.equal(sanitizeEmailHtml('<b onclick="x()" style="color:red">x</b>'), "<b>x</b>");
});

test("drops unknown tags but keeps their text", () => {
  assert.equal(sanitizeEmailHtml('<img src=x onerror=alert(1)>text<div>y</div>'), "texty");
});

test("keeps safe http/mailto links, dropping all other attrs", () => {
  assert.equal(
    sanitizeEmailHtml('<a href="https://x.com" onclick="bad()">x</a>'),
    '<a href="https://x.com">x</a>',
  );
});

test("drops javascript: links, keeping the text", () => {
  assert.equal(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>'), "x");
});

test("normalizes <br>", () => {
  assert.equal(sanitizeEmailHtml("a<br/>b<BR>c"), "a<br>b<br>c");
});

test("htmlToText converts blocks/breaks to newlines and strips tags", () => {
  assert.equal(htmlToText("<p>hi</p><ul><li>a</li><li>b</li></ul>"), "hi\na\nb");
});
