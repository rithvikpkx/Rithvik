import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/components/agent-log/log.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false, nocache: true } };

/** Minimal root layout for the owner-only admin pages: no site chrome, no design engine, no providers. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
