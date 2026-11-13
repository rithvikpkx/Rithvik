import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OwnerMark from "@/components/visitor-log/OwnerMark";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false, nocache: true } };

/** Root layout for the owner-only admin pages: no site chrome, no design engine. Each page wraps itself in AdminFrame,
 *  which carries the owner's active look (from the design cookie). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ margin: 0 }}>{children}<OwnerMark /></body>
    </html>
  );
}
