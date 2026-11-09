import type { Metadata } from "next";

export const metadata: Metadata = { title: "lab", robots: { index: false, follow: false } };

/** Bare root layout for per-stream component harnesses (/lab/<stream>). Not linked anywhere. */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
