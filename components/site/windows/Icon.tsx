import { ICONS } from "@/lib/assets/icons";

/** Inline Lucide icon from the ported set (static trusted SVG paths, mockup `icon()`). */
export default function Icon({ name }: { name: string }) {
  return (
    <svg className="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
  );
}
