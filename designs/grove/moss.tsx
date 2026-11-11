"use client";
// Grove's living moss, as SVG filters (no canvas, no second GL context): a glyph's alpha is frayed into fur-like
// strands by fine stretched noise, filled with clumps of moss greens, lit as a bumpy pile and given a soft contact
// shadow. One filter per scale: the name at desktop and phone sizes, and the Purdue P in its own (P-unit) space.

type Moss = { id: string; fur: string; fray: number; clump: number; bump: number; blur: number; dy: number };

const FILTERS: Moss[] = [
  { id: "gv-moss", fur: ".32 .95", fray: 7, clump: .04, bump: 3, blur: 3, dy: 4 },
  { id: "gv-moss-s", fur: ".5 1.3", fray: 4, clump: .07, bump: 2, blur: 2, dy: 2.5 },
  { id: "gv-moss-p", fur: "1.5 4.2", fray: 1.5, clump: .2, bump: .6, blur: .6, dy: .9 },
];

// moss greens from a clump noise channel n: deep shade (n=0) to sunlit tips (n=1)
const GREENS = ".42 0 0 0 .12  .5 0 0 0 .3  .16 0 0 0 .07  0 0 0 0 1";

/** One moss filter: frayed shape -> clump colour -> pile lighting -> contact shadow underneath. */
function MossFilter({ id, fur, fray, clump, bump, blur, dy }: Moss) {
  return (
    <filter id={id} x="-15%" y="-15%" width="130%" height="140%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={fur} numOctaves="2" seed="4" result="fur" />
      <feDisplacementMap in="SourceAlpha" in2="fur" scale={fray} xChannelSelector="R" yChannelSelector="G" result="shape" />
      <feTurbulence type="fractalNoise" baseFrequency={clump} numOctaves="3" seed="12" result="clump" />
      <feColorMatrix in="clump" type="matrix" values={GREENS} result="green" />
      <feDiffuseLighting in="fur" surfaceScale={bump} diffuseConstant="1.25" lightingColor="#FFF6DC" result="lit"><feDistantLight azimuth="235" elevation="48" /></feDiffuseLighting>
      <feComposite in="green" in2="lit" operator="arithmetic" k1="1.35" k2=".1" result="pile" />
      <feComposite in="pile" in2="shape" operator="in" result="moss" />
      <feGaussianBlur in="shape" stdDeviation={blur} result="sb" />
      <feOffset in="sb" dy={dy} result="so" />
      <feFlood floodColor="#020604" floodOpacity=".6" />
      <feComposite in2="so" operator="in" result="shadow" />
      <feMerge><feMergeNode in="shadow" /><feMergeNode in="moss" /></feMerge>
    </filter>
  );
}

/** The moss filters, rendered once at the page root. */
export function MossDefs() {
  return <svg className="el-defs" width="0" height="0" aria-hidden="true" focusable="false">{FILTERS.map((f) => <MossFilter key={f.id} {...f} />)}</svg>;
}
