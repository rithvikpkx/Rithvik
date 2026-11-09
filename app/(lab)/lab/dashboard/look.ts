import "server-only";
import { notFound } from "next/navigation";
import { getLook, getPalettes } from "@/lib/designs/server";
import { designById } from "@/lib/designs/registry";
import { lookFor } from "@/lib/analytics/look";
import { Geist, Geist_Mono } from "next/font/google";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/** The admin layout's fonts, for the lab's bare root layout. */
export const fontVars = `${sans.variable} ${mono.variable}`;

/** The lab's look from `?look=<design id | palette slug>` (else the design cookie, like /admin), plus the design's display font.
 *  Lab pages are local only: a production deployment 404s them. */
export async function labLook(sp: Record<string, string | string[] | undefined>) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const palettes = await getPalettes();
  const look = lookFor(await getLook(palettes, typeof sp.look === "string" ? sp.look : null), palettes);
  const meta = designById(look.id);
  return { look, font: meta?.cardFont, fonts: meta?.fonts ? `https://fonts.googleapis.com/css2?${meta.fonts}&display=swap` : null };
}
