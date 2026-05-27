import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rithvik Praveen Kumar — Plain HTML",
  // Bare mirror of the homepage; keep it out of the index to avoid duplicate content.
  robots: { index: false, follow: true },
};

// All styling for the plain pages lives here as one inline sheet — no globals,
// no theme tokens, no external fonts. A loving homage to berkshirehathaway.com.
const css = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 28px 24px 48px; max-width: 1100px;
    font-family: "Courier New", Courier, monospace;
    color: #1a1a1a; background: #ffffff; line-height: 1.55;
  }
  h1 {
    margin: 0; font-family: Georgia, "Times New Roman", serif;
    font-variant: small-caps; letter-spacing: 0.02em; color: #1a237e;
    font-size: 2rem;
  }
  h2 { font-family: Georgia, "Times New Roman", serif; color: #1a237e; margin-top: 0; }
  h3 { font-family: Georgia, "Times New Roman", serif; margin: 0 0 0.2em; }
  a:link { color: #0000cc; }
  a:visited { color: #551a8b; }
  a:hover { color: #cc0000; }
  hr { border: 0; border-top: 1px solid #888; margin: 22px 0; }
  .return a, .bh-footer a { font-weight: bold; }
  .bh-header { text-align: center; }
  .bh-header .addr { margin: 2px 0; font-weight: bold; }
  .index { display: flex; flex-wrap: wrap; gap: 16px 56px; }
  .index ul { margin: 0; padding-left: 22px; }
  .entry { margin-bottom: 18px; }
  .entry ul { margin: 4px 0; padding-left: 22px; }
  .tags, .meta { color: #555; font-size: 0.9em; }
  .bh-footer .note { color: #555; }
  @media (max-width: 640px) { .index { flex-direction: column; gap: 0; } }
`;

export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
