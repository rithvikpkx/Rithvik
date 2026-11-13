/**
 * Scrolls an element into view and flashes a highlight ring on it, so the RAG
 * bot can point at part of the page.
 *
 * Lives outside the component because it is imperative DOM work with a timer to
 * manage, and keeping it here means RagBot doesn't grow a second concern.
 */

const HIGHLIGHT_CLASS = "rag-highlight";
/** Matches the CSS animation duration; see `.rag-highlight` in globals.css. */
const HIGHLIGHT_MS = 1800;

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeEl: HTMLElement | null = null;

/** Clears any in-flight highlight so a second action doesn't leave the first
 *  element stuck lit. */
function clearActive() {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  activeEl?.classList.remove(HIGHLIGHT_CLASS);
  activeEl = null;
}

/**
 * Returns false when the target doesn't exist, so the caller can decide whether
 * to say something rather than silently doing nothing.
 *
 * The highlight fires even when no scrolling was needed — if the element is
 * already on screen, the scroll is a no-op and the flash is the only feedback
 * the visitor gets.
 */
export function scrollToAndHighlight(elementId: string): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(elementId);
  if (!el) return false;

  clearActive();

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });

  // Re-adding on the next frame restarts the animation if the same element was
  // just highlighted; without it the class is already present and nothing plays.
  requestAnimationFrame(() => {
    el.classList.add(HIGHLIGHT_CLASS);
    activeEl = el;
    activeTimer = setTimeout(() => {
      el.classList.remove(HIGHLIGHT_CLASS);
      activeEl = null;
      activeTimer = null;
    }, HIGHLIGHT_MS);
  });

  return true;
}
