import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import EditModeProvider from "@/components/EditModeProvider";
import InlineLoginPanel from "@/components/InlineLoginPanel";
import EditBar from "@/components/EditBar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = "https://rithvik.ai";
const description =
  "CS + Math student at Purdue University building AI systems, full-stack apps, and ambitious technical projects.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rithvik Praveen Kumar",
    template: "%s · Rithvik Praveen Kumar",
  },
  description,
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Rithvik Praveen Kumar",
    title: "Rithvik Praveen Kumar",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rithvik Praveen Kumar",
    description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <EditModeProvider>
          {children}
          <InlineLoginPanel />
          <EditBar />
        </EditModeProvider>
      </body>
    </html>
  );
}
