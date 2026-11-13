"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// five printed tones, dark to light: burnt umber, deep clay, clay, oat, paper (one table per channel, discrete = posterised)
const R = "0.3 0.62 0.85 0.91 0.965", G = "0.17 0.32 0.47 0.83 0.95", B = "0.13 0.22 0.34 0.72 0.91";

/** Clay: the portrait as a hand-pulled ink-and-wash print. The photo is posterised into clay and oat washes on cream
 *  paper, its edges traced as a wavering ink line (edge detection, then a slight displacement so it reads drawn). */
export default function ClayPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="clay" label="ink and wash" filter={<>
      <feColorMatrix type="matrix" values={LUM} result="g" />
      <feGaussianBlur in="g" stdDeviation="2" result="gb0" />
      {/* lift the mid-tones so skin settles in the clay washes rather than splitting into light and dark */}
      <feComponentTransfer in="gb0" result="gb"><feFuncR type="gamma" exponent=".8" /><feFuncG type="gamma" exponent=".8" /><feFuncB type="gamma" exponent=".8" /></feComponentTransfer>
      <feComponentTransfer in="gb" result="wash"><feFuncR type="discrete" tableValues={R} /><feFuncG type="discrete" tableValues={G} /><feFuncB type="discrete" tableValues={B} /></feComponentTransfer>
      <feConvolveMatrix in="gb" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e" />
      <feComponentTransfer in="e" result="ink"><feFuncR type="linear" slope="-5" intercept="1.04" /><feFuncG type="linear" slope="-5" intercept="1.04" /><feFuncB type="linear" slope="-5" intercept="1.04" /></feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="9" result="n" />
      <feDisplacementMap in="ink" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="line" />
      <feComposite in="wash" in2="line" operator="arithmetic" k1="1" />
    </>}>
      <span className="cy-pfx-paper" />
    </PhotoFx>
  );
}
