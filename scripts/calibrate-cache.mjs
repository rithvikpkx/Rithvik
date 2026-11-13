// Calibrates AGENT_CACHE_THRESHOLD: embeds paraphrase pairs (should hit) and every pair of distinct eval questions
// (must not hit) with the production embedding model, then reports the cosine distribution and, per threshold, how
// many of each would be served from cache. Needs only OPENAI_API_KEY (env or .env.local). Usage: node scripts/calibrate-cache.mjs
import { readFileSync, existsSync } from "node:fs";

if (!process.env.OPENAI_API_KEY && existsSync(".env.local")) {
	const m = readFileSync(".env.local", "utf8").match(/^OPENAI_API_KEY=(.*)$/m);
	if (m) process.env.OPENAI_API_KEY = m[1].trim().replace(/^["']|["']$/g, "");
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");

// Same normalisation as lib/suggestion-protocol.ts normalizeForMatch (what the route embeds).
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// [eval question, paraphrase]: the same ask in different words, which SHOULD be served from cache.
const PARAPHRASES = [
	["What is BoilerFrame?", "Can you tell me what BoilerFrame is?"],
	["What tech stack does BoilerFrame use?", "Which technologies is BoilerFrame built with?"],
	["Tell me about the mind-controlled robotic arm.", "What's the mind controlled robot arm project about?"],
	["What headset does the left/right thought prediction project use?", "Which headset is used in the left vs right thought prediction project?"],
	["How many EEG channels does the thought classifier use?", "How many channels of EEG does the thought classifier have?"],
	["What is QRIfy and where is it deployed?", "Where is QRIfy deployed and what does it do?"],
	["What does he research at Purdue?", "What is his research at Purdue about?"],
	["Who is his research advisor?", "Who advises his research?"],
	["What did he build for Habitat for Humanity?", "What was his Habitat for Humanity project?"],
	["What did the citizen happiness project model?", "What was modeled in the citizen happiness project?"],
	["Where was the happiness project built?", "Where did he build the happiness project?"],
	["what is boilerframe", "What is BoilerFrame??"],
	["Who is Rithvik?", "Tell me about Rithvik"],
	["Where does he go to school?", "Which university does he attend?"],
];

// Minimal pairs: the same template with ONE fact changed, so the answers differ. These are the real danger for a
// semantic cache, far more than unrelated questions.
const HARD_NEGATIVES = [
	["What did he build at Purdue?", "What did he build at Columbia?"],
	["What projects use Python?", "What projects use TypeScript?"],
	["Has he worked with AWS?", "Has he worked with Azure?"],
	["What is BoilerFrame?", "What is QRIfy?"],
	["What was his role at Code Ninjas?", "What was his role at Habitat for Humanity?"],
	["Where was the happiness project built?", "Where was QRIfy deployed?"],
	["What does he research at Purdue?", "What does he study at Purdue?"],
	["What tech stack does BoilerFrame use?", "What tech stack does QRIfy use?"],
	["What was his first internship?", "What was his latest internship?"],
	["How many channels does the thought classifier use?", "How many projects has he built?"],
	["Is he looking for internships?", "Is he looking for full-time roles?"],
	["What are his strengths in machine learning?", "What are his weaknesses in machine learning?"],
];

const evals = readFileSync("evals/agent.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l).q);
const texts = [...new Set([...evals, ...PARAPHRASES.flat(), ...HARD_NEGATIVES.flat()])];

const res = await fetch("https://api.openai.com/v1/embeddings", {
	method: "POST",
	headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
	body: JSON.stringify({ model: "text-embedding-3-small", input: texts.map(norm) }),
});
if (!res.ok) throw new Error(`embedding failed (${res.status}): ${await res.text()}`);
const vec = new Map((await res.json()).data.sort((a, b) => a.index - b.index).map((d, i) => [texts[i], d.embedding]));

const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y); };
const pos = PARAPHRASES.map(([a, b]) => ({ a, b, s: cos(vec.get(a), vec.get(b)) }));
const neg = [];
for (let i = 0; i < evals.length; i++) for (let j = i + 1; j < evals.length; j++) neg.push({ a: evals[i], b: evals[j], s: cos(vec.get(evals[i]), vec.get(evals[j])) });
const hard = HARD_NEGATIVES.map(([a, b]) => ({ a, b, s: cos(vec.get(a), vec.get(b)) })).sort((x, y) => y.s - x.s);
pos.sort((x, y) => x.s - y.s);
neg.sort((x, y) => y.s - x.s);

const f = (n) => n.toFixed(3);
console.log(`\nParaphrases (should hit), ${pos.length} pairs. min ${f(pos[0].s)}  median ${f(pos[pos.length >> 1].s)}  max ${f(pos.at(-1).s)}`);
for (const p of pos) console.log(`  ${f(p.s)}  ${p.a}  ~  ${p.b}`);
console.log(`\nDistinct eval questions (must not hit), ${neg.length} pairs. max ${f(neg[0].s)}  p99 ${f(neg[Math.floor(neg.length * 0.01)].s)}  median ${f(neg[neg.length >> 1].s)}`);
console.log("Closest distinct pairs:");
for (const p of neg.slice(0, 8)) console.log(`  ${f(p.s)}  ${p.a}  /  ${p.b}`);
console.log(`\nMinimal pairs, one fact changed (must not hit), ${hard.length} pairs. max ${f(hard[0].s)}`);
for (const p of hard) console.log(`  ${f(p.s)}  ${p.a}  /  ${p.b}`);
console.log("\nthreshold  paraphrases served  distinct pairs wrongly served  minimal pairs wrongly served");
for (const t of [0.8, 0.85, 0.88, 0.9, 0.92, 0.94, 0.95, 0.96, 0.97, 0.98]) {
	console.log(`  ${t.toFixed(2)}     ${String(pos.filter((p) => p.s >= t).length).padStart(2)}/${pos.length}             ${neg.filter((p) => p.s >= t).length}/${neg.length}                          ${hard.filter((p) => p.s >= t).length}/${hard.length}`);
}
