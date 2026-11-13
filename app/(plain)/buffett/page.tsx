/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element --
   /buffett lives in a separate root layout; next/link client-nav would skip that
   layout's bootstrap, so the internal "/" links use a plain <a> for a full load. A plain
   <img> is the point of the page. File-level so editor reformatting can't detach a directive. */
import { getContent } from "@/lib/content";
import type { Content } from "@/lib/content";

// Same cadence as the homepage content cache.
export const revalidate = 60;

const BH = "https://www.berkshirehathaway.com";
const center = { textAlign: "center" } as const;

/** A two-column table of plain link lists, the way the real home page lays out its index. */
function Index({ items }: { items: [href: string, label: string, note?: string][] }) {
	const rows: (typeof items)[] = [];
	for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
	return (
		<table cellSpacing={0} width="90%" align="center">
			<tbody>
				{rows.map((r, i) => (
					<tr key={i}>
						{r.map(([href, label, note]) => (
							<td key={href} valign="top" width="50%">
								<ul>
									<li>
										<a href={href}>{label}</a>
										{note ? (
											<>
												<br />
												<small>{note}</small>
											</>
										) : null}
									</li>
								</ul>
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

/** The plain-HTML homage page: server-rendered published content, no CSS, no JS. */
export default async function Buffett() {
	const c: Content = await getContent();
	const email = c.links.email.replace(/^mailto:/, "");
	const stack = Object.entries(c.stack);
	const edu = c.education;

	return (
		<>
			<p>
				<i>
					This page is an homage to the <a href={BH}>Berkshire Hathaway website</a>, famous for staying a plain,
					unstyled page of links while the rest of the web got louder. It carries the same information as my
					portfolio, with none of the design. <a href="/">Go to the full site.</a>
				</i>
			</p>
			<hr />

			<p style={center}>
				<b>
					<big>
						<big>{c.name.toUpperCase()}</big>
					</big>
					<br />
					{c.role}
					<br />
					Official Home Page
				</b>
			</p>
			<hr />

			<p style={center}>
				<img src="/images/rithvik.jpeg" alt={`Portrait of ${c.name}`} width={180} height={180} />
			</p>
			<p style={center}>
				{c.status}
				<br />
				{c.line}
			</p>
			<p style={center}>
				<a href={`mailto:${email}`}>Email</a> | <a href={c.links.github}>GitHub</a> |{" "}
				<a href={c.links.linkedin}>LinkedIn</a> | <a href="/resume.pdf">Resume</a>
			</p>

			<Index
				items={[
					["#about", "About"],
					["#projects", "Projects", `${c.projects.length} listed`],
					["#experience", "Experience"],
					["#education", "Education"],
					["#skills", "Skills"],
					["#faq", "Frequently Asked Questions"],
					["/resume.pdf", "Resume (PDF)"],
					["/", "The full site"],
				]}
			/>
			<hr />

			<h2 id="about">About</h2>
			{c.about.map((t, i) => (
				<p key={i}>{t}</p>
			))}

			<h2 id="projects">Projects</h2>
			{c.projects.map((p) => (
				<div key={p.slug}>
					<h3 id={`project-${p.slug}`}>{p.title}</h3>
					<p>
						<i>{p.headline}</i>
						{p.ctx ? <> ({p.ctx})</> : null}
					</p>
					<ul>
						{p.desc.map((d, i) => (
							<li key={i}>{d}</li>
						))}
					</ul>
					{p.tags.length ? <p>Technologies: {p.tags.join(", ")}</p> : null}
					{Object.keys(p.links).length ? (
						<p>
							{Object.entries(p.links).map(([label, url], i) => (
								<span key={label}>
									{i ? " | " : ""}
									<a href={url}>{label}</a>
								</span>
							))}
						</p>
					) : null}
				</div>
			))}

			<h2 id="experience">Experience</h2>
			{c.experience.map((r) => (
				<div key={r.slug}>
					<h3 id={`experience-${r.slug}`}>
						{r.role}, {r.org}
					</h3>
					<p>
						<i>
							{r.when}
							{r.where ? `, ${r.where}` : ""}
						</i>
					</p>
					<ul>
						{r.desc.map((d, i) => (
							<li key={i}>{d}</li>
						))}
					</ul>
					{r.tags.length ? <p>Technologies: {r.tags.join(", ")}</p> : null}
				</div>
			))}

			<h2 id="education">Education</h2>
			<p>
				<b>{edu.school}</b>
				<br />
				{edu.degree}
				{edu.focus ? `, ${edu.focus}` : ""}
				{edu.grad ? <> (expected {edu.grad})</> : null}
			</p>

			<h2 id="skills">Skills</h2>
			<ul>
				{stack.map(([group, items]) => (
					<li key={group}>
						<b>{group}:</b> {items.join(", ")}
					</li>
				))}
			</ul>

			<h2 id="faq">Frequently Asked Questions</h2>
			{c.faq.map(([q, a]) => (
				<p key={q}>
					<b>{q}</b>
					<br />
					{a}
				</p>
			))}

			<hr />
			<p style={center}>
				<a href="/">Return to the full site</a> | <a href={BH}>The real Berkshire Hathaway home page</a>
			</p>
			<p style={center}>
				<small>
					Copyright &copy; {new Date().getFullYear()} {c.name}
				</small>
			</p>
		</>
	);
}
