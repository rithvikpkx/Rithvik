import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import EditModeProvider from "@/components/EditModeProvider";
import InlineLoginPanel from "@/components/InlineLoginPanel";
import EditBar from "@/components/EditBar";
import ThemeStyleInjector from "@/components/ThemeStyleInjector";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeDial from "@/components/ThemeDial";
import { serverClient } from "@/lib/supabase";
import type { Theme } from "@/lib/types";
import { FALLBACK_THEMES, DEFAULT_THEME_SLUG, THEME_STORAGE_KEY } from "@/lib/themes";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = "https://rithvik.ai";
const description =
  "CS + Math student at Purdue University building AI systems, full-stack apps, and ambitious technical projects.";

// Themes can be added/updated directly in Supabase (outside the inline-edit
// flow that calls revalidatePath). Marking the root layout dynamic ensures
// new theme rows appear immediately without requiring a redeploy. The cost
// is one extra Supabase fetch per request, which is negligible.
export const dynamic = "force-dynamic";

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

// FOUC prevention — runs synchronously before paint so the saved theme is
// applied to <html> before any content renders.
const themeBootScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME_SLUG)};document.documentElement.dataset.theme=t;}catch(_){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data } = await serverClient().from("themes").select("*").order("sort_order");
  const themes = ((data ?? []) as Theme[]).filter((t) => t.published);
  const safeThemes = themes.length > 0 ? themes : FALLBACK_THEMES;

  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME_SLUG}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Theme variable definitions for every slug */}
        <ThemeStyleInjector themes={safeThemes} />
        {/* Boot script must run before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeProvider themes={safeThemes}>
          <EditModeProvider>
            {children}
            <InlineLoginPanel />
            <EditBar />
          </EditModeProvider>
          <ThemeDial />
        </ThemeProvider>
      </body>
    </html>
  );
}
