import "server-only";

/** Reads Rithvik's public GitHub code for the agent's read_code tool: a repo's README and file tree, or one file, or a
 *  list of his public repos. Responses are cached an hour (next fetch cache), so the unauthenticated 60/hr limit is
 *  rarely touched; GITHUB_TOKEN raises it if set. Never throws: a failure becomes a short sentence for the model. */

const API = "https://api.github.com";
const MAX_FILE = 8000; // characters of one file the model sees
const MAX_TREE = 150;  // paths listed from a repo's tree

const headers = (raw = false): HeadersInit => ({
  Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
  "User-Agent": "rithvik.ai-agent",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});
const get = (url: string, raw = false) => fetch(url, { headers: headers(raw), next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });

/** The GitHub user from a profile URL like https://github.com/rithvikpkx. */
export const githubUser = (url: string): string | null => url.match(/github\.com\/([A-Za-z0-9-]{1,39})\/?$/)?.[1] ?? null;

/** Repo names (owner must be `user`) linked from the project pages. */
export function linkedRepos(urls: string[], user: string): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    const m = u.match(/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
    if (m && m[1].toLowerCase() === user.toLowerCase()) out.add(m[2]);
  }
  return [...out];
}

/** The tool's text for the model plus a one-line summary for the visible tool row. */
export async function readCode(user: string, repo?: string, path?: string): Promise<{ text: string; summary: string }> {
  try {
    if (!repo) {
      const r = await get(`${API}/users/${user}/repos?per_page=50&sort=updated`);
      if (!r.ok) return { text: `GitHub returned ${r.status}; answer from the profile.`, summary: "GitHub unavailable" };
      const list = (await r.json()) as { name: string; description: string | null; language: string | null; fork: boolean }[];
      const own = list.filter((x) => !x.fork);
      return { text: own.map((x) => `- ${x.name}${x.language ? ` (${x.language})` : ""}${x.description ? `: ${x.description}` : ""}`).join("\n"), summary: `${own.length} public repos` };
    }
    const base = `${API}/repos/${user}/${encodeURIComponent(repo)}`;
    if (path) {
      const r = await get(`${base}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, true);
      if (!r.ok) return { text: `No file ${path} in ${repo} (${r.status}).`, summary: "file not found" };
      const body = await r.text();
      if (body.includes("\u0000")) return { text: `${path} is a binary file.`, summary: "binary file" };
      return { text: `${repo}/${path}${body.length > MAX_FILE ? ` (first ${MAX_FILE} chars)` : ""}:\n${body.slice(0, MAX_FILE)}`, summary: `${path} · ${Math.min(body.length, MAX_FILE).toLocaleString("en-US")} chars` };
    }
    const meta = await get(base);
    if (!meta.ok) return { text: `Repo ${repo} not reachable (${meta.status}).`, summary: "repo unavailable" };
    const m = (await meta.json()) as { default_branch: string; description: string | null; language: string | null };
    const [tree, readme] = await Promise.all([get(`${base}/git/trees/${m.default_branch}?recursive=1`), get(`${base}/readme`, true)]);
    const paths = tree.ok ? ((await tree.json()) as { tree: { path: string; type: string }[] }).tree.filter((t) => t.type === "blob").map((t) => t.path) : [];
    const rd = readme.ok ? (await readme.text()).slice(0, MAX_FILE) : "(no README)";
    return {
      text: `Repo ${repo}${m.language ? ` (${m.language})` : ""}${m.description ? `: ${m.description}` : ""}\nFiles (${paths.length}${paths.length > MAX_TREE ? `, first ${MAX_TREE}` : ""}):\n${paths.slice(0, MAX_TREE).join("\n")}\n\nREADME:\n${rd}`,
      summary: `README + ${paths.length} files`,
    };
  } catch {
    return { text: "GitHub timed out; answer from the profile.", summary: "GitHub unavailable" };
  }
}
