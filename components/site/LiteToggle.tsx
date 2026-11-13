"use client";
import { ICONS } from "@/lib/assets/icons";
import { useSite } from "./SiteProvider";

/** The performance-mode button (`html.lite`): freezes the shader to a still and rests effects. */
export default function LiteToggle({ className = "sw-ic" }: { className?: string }) {
  const { lite, setLite, toast } = useSite();
  return (
    <button
      type="button"
      className={className}
      aria-label="Performance mode"
      aria-pressed={lite}
      title="Performance mode: effects rest, the design stays"
      onClick={() => { setLite(!lite); toast(lite ? "Full effects back on" : "Performance mode on. Effects rest, the design stays."); }}
    >
      <svg className="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS["zap-off"] }} />
    </button>
  );
}
