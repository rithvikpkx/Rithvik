import type { Metadata } from "next";

export const metadata: Metadata = {
  // Second root layout — inherits nothing from (site), so metadataBase has to be
  // repeated here or relative URLs resolve against localhost:3000.
  metadataBase: new URL("https://rithvik.ai"),
  title: "Rithvik Praveen Kumar — Plain HTML",
  // Declared explicitly with an absolute URL. Left implicit, this page picked up
  // app/opengraph-image.tsx via the file convention, which resolves at the `app/`
  // root segment — a segment with no layout and therefore no metadataBase — and
  // emitted a localhost:3000 image URL into production HTML.
  openGraph: {
    type: "website",
    title: "Rithvik Praveen Kumar — Plain HTML",
    images: [{ url: "https://rithvik.ai/opengraph-image", width: 1200, height: 630 }],
  },
  // Bare mirror of the homepage; keep it out of the index to avoid duplicate content.
  robots: { index: false, follow: true },
};

// Deliberately no stylesheet: browser defaults plus the navy body text the real
// Berkshire Hathaway home page sets through its <body text> attribute.
export default function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ color: "#000080" }}>{children}</body>
    </html>
  );
}
