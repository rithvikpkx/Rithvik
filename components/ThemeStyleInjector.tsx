import { buildThemeStyleSheet } from "@/lib/themes";
import type { Theme } from "@/lib/types";

/**
 * SSR-only: renders a single <style> block containing every theme's CSS variables
 * scoped under :root[data-theme="<slug>"]. Theme swap = swap the data-theme
 * attribute on <html>. No re-render, no inline style writes.
 */
export default function ThemeStyleInjector({ themes }: { themes: Theme[] }) {
  const css = buildThemeStyleSheet(themes);
  return <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: css }} />;
}
