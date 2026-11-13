/** The floating windows' shared stacking and placement, so the agent (and a click) can bring any of them forward
 *  and move or resize them. Windows carry `data-win="<name>"`; the detached chat is one of them. */

let top = 93;
/** Brings a window above the others. */
export function raise(el: HTMLElement) { el.style.zIndex = String(++top); }

export type Spot = "left" | "right" | "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Size = "small" | "medium" | "large" | "full";
const SIZES: Record<Size, [number, number]> = { small: [0.3, 0.45], medium: [0.45, 0.65], large: [0.62, 0.82], full: [0.96, 0.9] };

/** Moves and/or resizes a window to a named spot and size (fractions of the viewport), kept on screen. */
export function place(el: HTMLElement, spot?: Spot, size?: Size) {
  if (innerWidth <= 640) return; // phones get bottom sheets
  if (size) {
    const [fw, fh] = SIZES[size];
    el.style.width = `${Math.max(300, Math.round(innerWidth * fw))}px`;
    el.style.height = `${Math.max(240, Math.round(innerHeight * fh))}px`;
  }
  const w = el.offsetWidth, h = el.offsetHeight, m = 16;
  const s = spot ?? "center";
  const x = s.includes("left") ? m : s.includes("right") ? innerWidth - w - m : (innerWidth - w) / 2;
  const y = s.startsWith("top") ? 76 : s.startsWith("bottom") ? innerHeight - h - m : (innerHeight - h) / 2;
  el.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - w - 8, x)))}px`;
  el.style.top = `${Math.round(Math.max(8, Math.min(innerHeight - h - 8, y)))}px`;
  raise(el);
}

/** The open window called `name`, if any. */
export const windowEl = (name: string) => document.querySelector<HTMLElement>(`[data-win="${CSS.escape(name)}"]`);
