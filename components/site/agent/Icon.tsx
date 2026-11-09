import { ICONS } from "@/lib/assets/icons";

/** A Lucide icon from the ported asset set. The SVG body is our own static data, never user input. */
export default function Icon({ name }: { name: string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />
  );
}
