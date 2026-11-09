import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./core.css";
import EditModeProvider from "@/components/EditModeProvider";
import ThemeStyleInjector from "@/components/ThemeStyleInjector";
import { BOOT_SCRIPT, designById, fontsHref, htmlAttrsFor, isDarkColor } from "@/lib/designs/registry";
import { getLook, getPalettes } from "@/lib/designs/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Separate root layout: inherits nothing from (site), so metadataBase is repeated.
  metadataBase: new URL("https://rithvik.ai"),
  title: "Rithvik Praveen Kumar",
  robots: { index: false, follow: false },
};

/** Root layout for the v7 site. The design cookie picks <html data-design data-theme> on the
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
        <EditModeProvider>{children}</EditModeProvider>
      </body>
    </html>
  );
}
