// Stipple's static print data: dispatch plate drawings, coupon fine print, reading time.

/** Coupon fine print, one per toy. */
export const GOOD: Record<string, string> = { records: "Good for one scratch", artboard: "Good for one doodle", typeracer: "Good for one sprint", angle: "Good for one guess", dots: "Good for one squint", center: "Good for one div" };

/** Small abstract plate per dispatch (SVG children, our own constants), stippled by the shared filter. */
export const ART: Record<string, string> = {
  "mind-controlled-arm": `<circle cx="104" cy="92" r="50"/><path d="M150 118 L214 84 L266 134" fill="none" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><circle cx="274" cy="142" r="18"/>`,
  boilerframe: `<rect x="62" y="34" width="196" height="122" fill="none" stroke-width="22"/><circle cx="160" cy="92" r="30"/><rect x="62" y="170" width="18" height="12"/><rect x="104" y="170" width="18" height="12"/><rect x="146" y="170" width="18" height="12"/><rect x="230" y="170" width="28" height="12"/>`,
  "eeg-thought-prediction": `<path d="M14 104 C 48 18, 82 190, 116 104 S 184 18, 218 104 S 280 170, 306 92" fill="none" stroke-width="24" stroke-linecap="round"/><circle cx="62" cy="168" r="13"/><circle cx="258" cy="36" r="13"/>`,
  "citizen-happiness": `<rect x="64" y="104" width="34" height="70"/><rect x="122" y="70" width="34" height="104"/><rect x="180" y="40" width="34" height="134"/><path d="M40 140 Q 160 150 280 30" fill="none" stroke-width="16" stroke-linecap="round"/>`,
  qrify: `<rect x="58" y="28" width="58" height="58" fill="none" stroke-width="16"/><rect x="77" y="47" width="20" height="20"/><rect x="204" y="28" width="58" height="58" fill="none" stroke-width="16"/><rect x="223" y="47" width="20" height="20"/><rect x="58" y="114" width="58" height="58" fill="none" stroke-width="16"/><rect x="77" y="133" width="20" height="20"/><rect x="140" y="40" width="20" height="20"/><rect x="140" y="96" width="38" height="20"/><rect x="204" y="118" width="20" height="54"/><rect x="242" y="140" width="20" height="20"/><rect x="152" y="140" width="20" height="32"/>`,
  "habitat-humanity-ecomm": `<path d="M78 104 L160 36 L242 104 Z"/><path d="M98 104 H222 V174 H174 V128 H146 V174 H98 Z"/><circle cx="262" cy="56" r="12"/>`,
};

/** Reading time in seconds at 230 wpm, never under 6. */
export const readSecs = (p: { headline: string; ctx: string; desc: string[] }) =>
  Math.max(6, Math.round(([p.headline, p.ctx, ...p.desc].join(" ").split(/\s+/).length / 230) * 60));
