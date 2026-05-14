/**
 * Server-side text extraction for secondary RAG documents. Each extractor
 * takes a Buffer + mime type and returns plain text to be chunked + embedded.
 *
 * Add a new file type by writing an extractor function and adding a case
 * in `extractText`. Returns null for unsupported types so the upload action
 * can refuse the file with a clear error.
 */
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ExtractResult =
  | { kind: "text"; text: string }
  | { kind: "image"; bytes: Buffer; mime: string }
  | { kind: "unsupported"; reason: string };

export async function extractText(bytes: Buffer, mime: string): Promise<ExtractResult> {
  if (TEXT_MIMES.has(mime)) return { kind: "text", text: bytes.toString("utf8") };
  if (mime === PDF_MIME)    return { kind: "text", text: await extractPdf(bytes) };
  if (mime === DOCX_MIME)   return { kind: "text", text: await extractDocx(bytes) };
  if (IMAGE_MIMES.has(mime)) return { kind: "image", bytes, mime };
  return { kind: "unsupported", reason: `MIME type "${mime}" is not supported.` };
}

async function extractPdf(bytes: Buffer): Promise<string> {
  // pdf-parse v2 is class-based and consumes a Uint8Array. Buffer extends
  // Uint8Array in Node, but the v2 types want a plain Uint8Array, so we
  // wrap explicitly. destroy() releases the worker after extraction.
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.trim();
}

const CAPTION_MODEL = "gpt-4o-mini";

const CAPTION_PROMPT = `You are helping build a searchable knowledge base about a person named Rithvik.
Describe this image in detail in 2–4 sentences. Cover:
- What is depicted (subject, setting, mood).
- Any visible text, captions, labels, or handwriting (transcribe them).
- Any context clues about what the image relates to (a project, a place, a document, a moment).
Plain prose, no markdown.`;

/** Calls OpenAI Vision with the image bytes (base64) and returns a description
 *  that will be chunked + embedded like any other text source. */
export async function captionImage(bytes: Buffer, mime: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CAPTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Image caption failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const caption = json.choices[0]?.message?.content?.trim();
  if (!caption) throw new Error("Image caption returned empty content");
  return caption;
}
