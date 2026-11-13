import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./core.css";
import EditModeProvider from "@/components/EditModeProvider";
import EditModeOverlays from "@/components/site/EditModeOverlays";
import ThemeStyleInjector from "@/components/ThemeStyleInjector";
import { BOOT_SCRIPT, designById, fontsHref, htmlAttrsFor, isDarkColor } from "@/lib/designs/registry";
import { getLook, getPalettes } from "@/lib/designs/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = "https://rithvik.ai"; // the apex is the serving host (www 307s to it); see CLAUDE.md
const ogAlt = "Rithvik Praveen Kumar — CS + Math @ Purdue"; // kept in sync with app/opengraph-image.alt.txt
const description =
  "Software and AI engineer studying CS + Math at Purdue. Brain-computer interfaces, computer vision, and ML small enough for a microcontroller.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Rithvik Praveen Kumar", template: "%s · Rithvik Praveen Kumar" },
  description,
  openGraph: {
    type: "website", url: siteUrl, siteName: "Rithvik Praveen Kumar", title: "Rithvik Praveen Kumar", description, locale: "en_US",
    // Declaring openGraph suppresses the opengraph-image file convention, so point at the route by hand.
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: ogAlt }],
  },
  twitter: { card: "summary_large_image", title: "Rithvik Praveen Kumar", description, images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: ogAlt }] },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
};

/** Root layout for the site (v7). The design cookie picks <html data-design data-theme> on the
 *  server, and BOOT_SCRIPT corrects it before first paint when the cookie can't (see registry). */
export default async function V7Layout({ children }: { children: React.ReactNode }) {
  const themes = await getPalettes();
  const look = await getLook(themes);
  const { design, theme } = htmlAttrsFor(look);
  const meta = designById(look);
  const fonts = fontsHref(meta);
  const dark = meta ? meta.dark : isDarkColor(themes.find((t) => t.slug === look)?.tokens.bg);

  return (
    <html
      lang="en"
      data-design={design}
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: dark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {fonts && <link rel="stylesheet" href={fonts} data-font={look} />}
      </head>
      <body>
        {/* Palette tokens for every slug; BOOT_SCRIPT reads this sheet, so it must come first. */}
        <ThemeStyleInjector themes={themes} />
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <EditModeProvider>
          {children}
          <EditModeOverlays />
        </EditModeProvider>
      </body>
    </html>
  );
}
