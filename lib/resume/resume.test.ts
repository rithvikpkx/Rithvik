import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfProblem, redactResume, staleVersions, MAX_PDF_BYTES, cleanResumeHtml } from "./pure.ts";

const pdf = (n = 100) => new Uint8Array(n).fill(65).map((b, i) => (i < 5 ? "%PDF-".charCodeAt(i) : b));

test("pdfProblem accepts a PDF and rejects bad magic, size and content-type", () => {
  assert.equal(pdfProblem(pdf(), "application/pdf"), null);
  assert.equal(pdfProblem(pdf()), null);
  assert.match(pdfProblem(new TextEncoder().encode("<html>sign in</html>"), "application/pdf")!, /not a PDF/);
  assert.match(pdfProblem(pdf(MAX_PDF_BYTES + 1))!, /5 MB/);
  assert.match(pdfProblem(pdf(), "text/html")!, /content-type/);
  assert.match(pdfProblem(new Uint8Array())!, /empty/);
});

test("redactResume drops the phone and graduation date, keeps the rest", () => {
  const out = redactResume("﻿Rithvik (U.S. Citizen)\r\na@b.com | (508) 382-2974 | Boston, MA\r\nB.S. in CS\r\n\tExpected May 2028\r\n\t3.74 / 4.00\r\nIntern, Jun 2025 - Aug 2025");
  assert.ok(!/508|382|2974|Expected|2028/.test(out), out);
  for (const keep of ["U.S. Citizen", "a@b.com | Boston, MA", "B.S. in CS", "3.74 / 4.00", "Jun 2025 - Aug 2025"]) assert.ok(out.includes(keep), keep);
  assert.ok(!out.includes("\r") && !out.includes("﻿"));
});

test("redactResume handles inline and other formats", () => {
  assert.equal(redactResume("B.S. CS | Expected: Spring 2028 | GPA 3.7"), "B.S. CS | GPA 3.7");
  assert.equal(redactResume("call +1 508.382.2974 now"), "call  now");
  assert.equal(redactResume("Class of 2028"), "");
  assert.equal(redactResume("Expected to ship the system quickly"), "Expected to ship the system quickly");
});

test("staleVersions keeps the newest 10 and never the current one", () => {
  const rows = Array.from({ length: 13 }, (_, i) => ({ id: i, created_at: `2026-01-${String(i + 1).padStart(2, "0")}`, is_current: i === 0 }));
  const stale = staleVersions(rows).map((r) => r.id).sort((a, b) => a - b);
  assert.deepEqual(stale, [1, 2]); // 0 is oldest but current
});

test("cleanResumeHtml: no scripts or handlers, real links, no phone or graduation date", () => {
  const out = cleanResumeHtml(`<html><head><script>x()</script><meta http-equiv="refresh" content="0"></head><body onload="x()"><p>Call (508) 382-2974</p><p>Expected May 2028</p><a href="https://www.google.com/url?q=https%3A%2F%2Fgithub.com%2Frithvikpkx&amp;sa=D">gh</a><a href="javascript:alert(1)">bad</a></body></html>`);
  for (const bad of ["<script", "onload", "http-equiv", "382-2974", "2028", "javascript:"]) assert.ok(!out.includes(bad), `${bad} survived`);
  assert.ok(out.includes('href="https://github.com/rithvikpkx"') && out.includes('target="_blank"') && out.includes("max-width:none"));
  // the stylesheet is left alone even where its digits look like a phone number
  const css = ".lst-kix_7jhr5kqklli8-7{x:1} .c1{width:5085551234px}";
  assert.ok(cleanResumeHtml(`<html><head><style>${css}</style></head><body>(508) 382-2974</body></html>`).includes(css));
});
