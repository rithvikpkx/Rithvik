// Renders docs/brand/concepts.svg (+ .png): the four logo directions explored in review round 2, each at 200/64/32/16px
// on light and dark, so the owner can see the alternatives to the chosen "Swallow". Run: npm run brand:concepts
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { ouroPath } from "../../components/site/mark/ouro.ts";

type V = [number, number];
const rad = (d: number) => (d * Math.PI) / 180, f = (p: V) => p[0].toFixed(2) + " " + p[1].toFixed(2);

/** A polar band: centreline radius r(s), width w(s), s in degrees from the head (angle h) going anticlockwise; round caps both ends. */
function band(h: number, S: number, r: (s: number) => number, w: (s: number) => number): string {
  const pt = (rr: number, s: number): V => [rr * Math.cos(rad(h - s)), rr * Math.sin(rad(h - s))];
  const cap = (s: number, back: boolean): V[] => {
    const a = rad(h - s), n: V = [Math.cos(a), Math.sin(a)], t: V = [Math.sin(a), -Math.cos(a)], c = pt(r(s), s), rho = w(s) / 2, out: V[] = [];
    for (let phi = 0; phi <= 180; phi += 10) { const k = back ? phi : 180 + phi; out.push([c[0] + rho * (n[0] * Math.cos(rad(k)) + t[0] * Math.sin(rad(k))), c[1] + rho * (n[1] * Math.cos(rad(k)) + t[1] * Math.sin(rad(k)))]); }
    return out;
  };
  const ss: number[] = []; for (let s = 0; s <= S; s += 2) ss.push(s);
  const ring = [...ss.map((s) => pt(r(s) + w(s) / 2, s)), ...cap(S, true), ...ss.reverse().map((s) => pt(r(s) - w(s) / 2, s)), ...cap(0, false)];
  return "M" + ring.map(f).join(" L") + " Z";
}

export const CONCEPTS: { id: string; name: string; note: string; d: string }[] = [
  { id: "a", name: "A  Swallow (chosen)", note: "one band, tail eased into a socket in the head; the hairline is a single S", d: ouroPath().d },
  { id: "b", name: "B  Coil", note: "a spiral of 1.25 turns: the loop as recursion; tail tucked inside the head", d: band(-40, 450, (s) => 36 - s * 0.042, (s) => 15 * (s < 330 ? 1 : 0.35 + 0.65 * Math.cos(rad(((s - 330) / 120) * 90)))) },
  { id: "c", name: "C  Chain", note: "three links, each swallowing the next: every part eats its own tail", d: ouroPath({ N: 3, hold: 40, T: 16, tip: 6, W: 20 }).d },
  { id: "d", name: "D  Bite", note: "even weight, a needle tail driven into a V mouth: the old mark, minus the eye", d: ouroPath({ hold: 300, tip: 0.01, T: 18, W: 18, gap: 2.6 }).d },
];

const cell = (d: string, x: number, y: number, s: number, fill: string) => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="-50 -50 100 100"><path d="${d}" fill="${fill}"/></svg>`;
const COL = 300, W = COL * CONCEPTS.length, H = 640, font = `font-family="Geist, Inter, system-ui, sans-serif"`;
let body = `<rect width="${W}" height="${H / 2}" fill="#fafaf9"/><rect y="${H / 2}" width="${W}" height="${H / 2}" fill="#0c0c10"/>`;
CONCEPTS.forEach((c, i) => {
  const x = i * COL;
  for (const [y0, ink, sub] of [[0, "#16161a", "#6b6b73"], [H / 2, "#f2f2f4", "#8a8a94"]] as const) {
    body += cell(c.d, x + 30, y0 + 24, 200, ink) + cell(c.d, x + 30, y0 + 236, 64, ink) + cell(c.d, x + 110, y0 + 252, 32, ink) + cell(c.d, x + 158, y0 + 260, 16, ink);
    if (y0 === 0) body += `<text x="${x + 30}" y="${y0 + 22}" ${font} font-size="15" font-weight="600" fill="${ink}" dy="-4">${c.name}</text>`;
    else body += `<text x="${x + 30}" y="${y0 + 314}" ${font} font-size="11" fill="${sub}">${c.note}</text>`;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>\n`;
writeFileSync("docs/brand/concepts.svg", svg);
await sharp(Buffer.from(svg), { density: 144 }).png().toFile("docs/brand/concepts.png");
