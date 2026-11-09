import { ICONS, LOGOS } from "@/lib/assets/icons";

/** Lucide icon by name (24px stroke set from lib/assets). The markup is our own static asset, never user input. */
export function Icon({ name, className = "ic" }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
  );
}

/** Brand logo by Simple Icons slug; renders nothing for an unknown slug. */
export function Logo({ slug, className = "logo" }: { slug: string; className?: string }) {
  const L = (LOGOS as Record<string, { d?: string; svg16?: string }>)[slug];
  if (!L) return null;
  if (L.svg16) return <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: L.svg16 }} />;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={L.d} />
    </svg>
  );
}
