import React from "react";

/* Minimal markdown renderer for chat messages.
   Handles: headings (#/##/###), bold (**), italic (*), inline code (`),
   fenced code blocks (```), bullet/numbered lists, links, paragraphs.
   Output is wrapped in a <div class="rag-md"> so styling lives in globals.css. */

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "pre"; text: string };

// Split raw text into block-level chunks before any inline formatting.
function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({ type: "pre", text: buf.join("\n") });
      continue;
    }

    // Heading
    const hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (hMatch) {
      blocks.push({ type: "h", level: hMatch[1].length as 1 | 2 | 3, text: hMatch[2] });
      i++;
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: accumulate consecutive non-blank, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) blocks.push({ type: "p", lines: buf });
  }

  return blocks;
}

// Inline parser: walk a string and emit React nodes for bold/italic/code/link.
// Order matters — code first (so we don't format inside backticks), then links,
// then bold, then italic.
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Single regex with alternation: code | link | bold | italic.
  // Each alternative is captured so we can identify which one matched.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/;

  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (!match) {
      nodes.push(remaining);
      break;
    }

    const matchIdx = match.index;
    if (matchIdx > 0) nodes.push(remaining.slice(0, matchIdx));

    const token = match[0];
    if (match[1]) {
      // inline code
      nodes.push(<code key={`${keyBase}-${key++}`}>{token.slice(1, -1)}</code>);
    } else if (match[2]) {
      // link [text](url)
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (linkMatch) {
        const url = linkMatch[2];
        const isExternal = /^https?:\/\//i.test(url);
        nodes.push(
          <a
            key={`${keyBase}-${key++}`}
            href={url}
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {linkMatch[1]}
          </a>
        );
      }
    } else if (match[3]) {
      // **bold**
      nodes.push(<strong key={`${keyBase}-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (match[4] || match[5]) {
      // *italic* or _italic_
      nodes.push(<em key={`${keyBase}-${key++}`}>{token.slice(1, -1)}</em>);
    }

    remaining = remaining.slice(matchIdx + token.length);
  }

  return nodes;
}

// Convert a paragraph's line array into rendered children, treating a single
// newline as a soft <br /> so streaming tokens with mid-paragraph breaks render.
function renderParagraph(lines: string[], keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyBase}-br-${idx}`} />);
    out.push(...renderInline(line, `${keyBase}-${idx}`));
  });
  return out;
}

export default function SimpleMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);

  return (
    <div className="rag-md">
      {blocks.map((block, idx) => {
        const k = `b${idx}`;
        if (block.type === "p") {
          return <p key={k}>{renderParagraph(block.lines, k)}</p>;
        }
        if (block.type === "h") {
          const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
          return <Tag key={k}>{renderInline(block.text, k)}</Tag>;
        }
        if (block.type === "ul") {
          return (
            <ul key={k}>
              {block.items.map((item, i) => (
                <li key={`${k}-${i}`}>{renderInline(item, `${k}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={k}>
              {block.items.map((item, i) => (
                <li key={`${k}-${i}`}>{renderInline(item, `${k}-${i}`)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "pre") {
          return (
            <pre key={k}>
              <code>{block.text}</code>
            </pre>
          );
        }
        return null;
      })}
    </div>
  );
}
