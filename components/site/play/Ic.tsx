import { ICONS } from "@/lib/assets/icons";

/** A Lucide icon by name, drawn in currentColor (same stroke settings as the mockup's icon()). */
export default function Ic({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`ic ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
  );
}
