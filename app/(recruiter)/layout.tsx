import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../(v7)/core.css";
import "@/components/recruiter/recruiter.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://rithvik.ai"), // its own root layout, so the base is repeated (see app/(plain)/layout.tsx)
  title: "Rithvik Praveen Kumar · Recruiter view",
  description: "The essentials, on one page: resume, projects, experience and a way to reach Rithvik.",
  alternates: { canonical: "/recruiter" },
  openGraph: { type: "website", title: "Rithvik Praveen Kumar · Recruiter view", images: [{ url: "https://rithvik.ai/opengraph-image.png", width: 1200, height: 630 }] },
};

// Light or dark before first paint: the visitor's last pick, else their system's.
const THEME_BOOT = `try{var t=localStorage.getItem("rithvik-rt");document.documentElement.dataset.rt=t==="dark"||t==="light"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.rt="light"}`;

/** Recruiter mode's own root layout: no design engine, no shaders, no effects; just the content, light or dark. */
export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} data-rt="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body>{children}</body>
    </html>
  );
}
