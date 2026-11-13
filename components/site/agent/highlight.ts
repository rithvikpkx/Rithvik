/** Scrolls a cited element into view and gives it a soft, fading accent ring (`.agent-hl`, agent.css).
 *  Navigation only, so no confirmation: the visitor undoes it by scrolling. Ported from the old
 *  lib/scroll-highlight.ts. The decision of whether to auto-scroll lives in lib/agent/highlight.ts. */

const HL_MS = 1600; // matches the agent-hl animation
let active: { el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;

/** Returns false when the element isn't in the current design. */
export function scrollAndHighlight(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  if (active) { clearTimeout(active.timer); active.el.classList.remove("agent-hl"); }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  // Next frame so re-highlighting the same element restarts the fade.
  requestAnimationFrame(() => {
    el.classList.add("agent-hl");
    active = { el, timer: setTimeout(() => { el.classList.remove("agent-hl"); active = null; }, HL_MS) };
  });
  return true;
}
