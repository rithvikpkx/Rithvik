/**
 * Embeds all site content into the Supabase pgvector store.
 * Run with: OPENAI_API_KEY=... npx tsx scripts/embed.ts
 * Re-run whenever site content changes significantly.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  "https://djxiyvczcvgfelhwrlkf.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface Chunk {
  content: string;
  metadata: Record<string, string>;
}

const chunks: Chunk[] = [
  {
    content: "Rithvik Praveen Kumar is a CS + Mathematics student at Purdue University in West Lafayette, Indiana. He started in August 2023 and is concentrating in Software Engineering and AI/ML.",
    metadata: { section: "bio" },
  },
  {
    content: "Rithvik is passionate about building at the intersection of AI, systems, and real-world problems. His interests include full-stack engineering, AI systems, applied ML, computer systems, startups, research, and open source.",
    metadata: { section: "bio" },
  },
  {
    content: "Rithvik is currently building Rithvik.ai — a full-stack AI-powered personal portfolio with a RAG chatbot and live admin UI. Tech stack: Next.js, Supabase, Claude API.",
    metadata: { section: "projects", project: "rithvik-ai" },
  },
  {
    content: "WatchDawg is a cloud-running browser monitor by Rithvik that checks dynamic webpages, compares values against a baseline, and sends notifications when changes are detected. Built with TypeScript and Playwright.",
    metadata: { section: "projects", project: "watchdawg" },
  },
  {
    content: "BoilerFrame is a full-stack web app by Rithvik that uses AWS Rekognition to identify where a target person appears in uploaded video content.",
    metadata: { section: "projects", project: "boilerframe" },
  },
  {
    content: "Pratigya is an AI-powered learning platform for rural learners built by Rithvik. It includes lessons, quizzes, assignments, and a context-aware chatbot grounded in course content using RAG.",
    metadata: { section: "projects", project: "pratigya" },
  },
  {
    content: "Rithvik studies at Purdue University pursuing a B.S. in Computer Science and Mathematics with concentrations in Software Engineering and AI/ML.",
    metadata: { section: "education" },
  },
  {
    content: "Since 2023, Rithvik has been an independent builder shipping full-stack and AI projects across web development, computer vision, browser automation, and education technology.",
    metadata: { section: "experience" },
  },
  {
    content: "Rithvik's technical skills include: Python, TypeScript, JavaScript, React, Next.js, Node.js, Supabase, AWS, Playwright, Vercel, Git, SQL, C, Java, NumPy, Pandas, scikit-learn, OpenAI API, Claude API.",
    metadata: { section: "skills" },
  },
  {
    content: "Rithvik can be reached at rithvikpkx@gmail.com. His GitHub is github.com/rithvikpkx. He is interested in software engineering, AI, startups, research, and ambitious technical projects.",
    metadata: { section: "contact" },
  },
];

async function embedText(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error: ${err}`);
  }

  const json = await res.json() as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");

  console.log(`Embedding ${chunks.length} chunks…`);

  await db.from("embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.content);
    const { error } = await db.from("embeddings").insert({
      content: chunk.content,
      metadata: chunk.metadata,
      embedding,
    });
    if (error) { console.error("Insert error:", error.message); process.exit(1); }
    process.stdout.write(".");
  }

  console.log(`\n✓ ${chunks.length} chunks embedded.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
