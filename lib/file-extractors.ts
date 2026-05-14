/**
 * Server-side text extraction for secondary RAG documents. Each extractor
 * takes a Buffer + mime type and returns plain text to be chunked + embedded.
 *
 * Add a new file type by writing an extractor function and adding a case
 * in `extractText`. Returns null for unsupported types so the upload action
 * can refuse the file with a clear error.
 */
import { extractText as unpdfExtractText } from "unpdf";
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

/** Dispatch by MIME type: returns text for readable formats, raw bytes for
 *  images (caller can caption later), or an unsupported tag with a reason. */
export async function extractText(bytes: Buffer, mime: string): Promise<ExtractResult> {
  if (TEXT_MIMES.has(mime)) return { kind: "text", text: bytes.toString("utf8") };
  if (mime === PDF_MIME)    return { kind: "text", text: await extractPdf(bytes) };
  if (mime === DOCX_MIME)   return { kind: "text", text: await extractDocx(bytes) };
  if (IMAGE_MIMES.has(mime)) return { kind: "image", bytes, mime };
  return { kind: "unsupported", reason: `MIME type "${mime}" is not supported.` };
}

/** Extract plain text from a PDF buffer. Uses unpdf — a serverless-friendly
 *  wrapper around pdfjs-dist that ships the polyfills (DOMMatrix, etc.) that
 *  Vercel/Node functions don't expose natively. pdf-parse v2 crashed at
 *  module evaluation on Vercel for that reason. */
async function extractPdf(bytes: Buffer): Promise<string> {
  // mergePages: true makes `text` a single string. The function's overload
  // surface is loose enough that TS doesn't narrow it, so handle both shapes.
  const result = await unpdfExtractText(new Uint8Array(bytes), { mergePages: true });
  const text = result.text as string | string[];
  return (typeof text === "string" ? text : text.join("\n\n")).trim();
}

/** Extract plain text from a DOCX buffer via mammoth. No teardown — mammoth's
 *  extractRawText is fully buffered and returns a plain result object. */
async function extractDocx(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.trim();
}

const CAPTION_MODEL = "gpt-4o-mini";
const CAPTION_MAX_TOKENS = 400;

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
      max_tokens: CAPTION_MAX_TOKENS,
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
