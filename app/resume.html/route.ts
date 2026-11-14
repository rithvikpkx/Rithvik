import { getResumeHtml } from "@/lib/resume/sync";

/** GET /resume.html: the current resume as clean HTML, framed by the resume window (same origin only). 404 when the
 *  export is unavailable, so the window falls back to the PDF. */
export async function GET() {
  const html = await getResumeHtml();
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
}
