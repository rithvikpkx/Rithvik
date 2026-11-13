import "server-only";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** The admin layout's fonts, for the lab's bare root layout. */
export const fontVars = `${sans.variable} ${mono.variable}`;

/** Lab pages are local only: a production deployment 404s them. */
export function labGuard() {
  if (process.env.VERCEL_ENV === "production") notFound();
}
