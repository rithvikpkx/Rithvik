import type { DesignMeta } from "../../lib/designs/types";

// Clay: warm paper, clay and ink, after Claude's visual language (colour, type feel, texture). No logos or marks.
// The shader is a sheet of cream paper with a few watercolour blooms (clay, oat, olive, sky) whose pigment pools at
// the edges, two of them traced by an offset hand-drawn ink line; the blooms lean toward the pointer like wet paint
// and, while the pointer is over the hero (`u_wet`), a small wet drop follows it.
export const META: DesignMeta = {
  id: "clay", name: "Clay", mood: "warm paper, clay and ink", dark: false,
  keywords: ["clay", "claude", "anthropic", "paper", "ink", "watercolour", "watercolor", "terracotta", "cream", "warm", "crafted", "human", "serif"],
  swatch: ["#FAF9F5", "#141413", "#D97757", "#788C5D"],
  cardFont: "\"Newsreader\", Georgia, serif",
  fonts: "family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=Schibsted+Grotesk:wght@400..700&family=JetBrains+Mono:wght@400..600",
  shader: {
    colors: ["#F6F2E8", "#D97757", "#D4A27F", "#2E2B25"], scale: 0.6, host: "#cy-paper",
    source: `uniform float u_wet;
// cheap value-noise octaves: the wash edges and the paper only need soft irregularity
float wn(vec2 p){ return vnoise(p) * .55 + vnoise(p * 2.13 + 7.1) * .3 + vnoise(p * 4.7 + 3.3) * .15; }
// one watercolour bloom multiplied onto the paper: a soft wash, pigment pooled at the rim, granulation in the tooth
vec3 bloom(vec3 c, vec2 p, vec2 o, float r, vec3 pig, float amt, float seed, float t, float tooth){
  vec2 q = (p - o) / r;
  float d = length(q) + (wn(q * 1.6 + seed + t * .025) - .5) * .55;
  float wash = smoothstep(1., .9, d) * (.75 + .25 * smoothstep(.2, .85, d));
  float rim = exp(-pow((d - .965) * 16., 2.));
  float a = clamp((wash * .36 + rim * .38) * (.78 + .44 * tooth) * amt, 0., .85);
  return c * mix(vec3(1.), pig, a);
}
// a hand-drawn ink outline, offset from its wash like a print slightly out of register; its width wavers like a nib
float inkline(vec2 p, vec2 o, float r, float seed, float t, float px){
  vec2 q = (p - o) / r;
  float d = length(q) + (wn(q * 1.25 + seed + t * .018) - .5) * .42;
  float w = (.0016 + .0026 * vnoise(vec2(atan(q.y, q.x) * 2.2 + seed, seed))) / r;
  float gap = smoothstep(.35, .5, vnoise(vec2(atan(q.y, q.x) * 1.4, seed * 3.))); // the pen lifts now and then
  return (1. - smoothstep(w, w + px * 1.6 / r, abs(d - 1.))) * gap;
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, px = 1. / u_res.y, t = u_time;
  float tall = 1. - smoothstep(.75, 1.2, asp);
  vec2 p = (uv - .5) * vec2(asp, 1.), m = (u_mouse - .5) * vec2(asp, 1.);
  // paper: cream stock, long fibres, fine tooth, the edges a shade warmer
  float fib = vnoise(fc * vec2(.55, .045) + 2.);
  float tooth = vnoise(fc * .55);
  vec3 c = u_c0 * (1. + .03 * (fib - .5) + .02 * (tooth - .5));
  c = mix(c, c * vec3(.97, .94, .89), smoothstep(.45, 1.05, length((uv - .5) * vec2(1.15, 1.4))));
  // blooms: positions keep the copy column clear (left on desktop, top on a phone)
  float br = .5 + .5 * sin(t * .21);
  vec2 o1 = mix(vec2(asp * .3, -.16), vec2(.04, -.22), tall);
  vec2 o2 = mix(vec2(-asp * .36, -.4), vec2(-asp * .42, -.44), tall);
  vec2 o3 = mix(vec2(asp * .43, .33), vec2(asp * .48, .08), tall);
  vec2 o4 = mix(vec2(-asp * .46, .41), vec2(asp * .44, .44), tall);
  float s = mix(1., .78, tall);
  // wet paint leans toward the brush
  vec2 lean = (m - o1) * .1 * exp(-dot(m - o1, m - o1) * 3.);
  o1 += lean + vec2(sin(t * .07), cos(t * .05)) * .02;
  o3 += (m - o3) * .08 * exp(-dot(m - o3, m - o3) * 5.) + vec2(cos(t * .06), sin(t * .08)) * .015;
  c = bloom(c, p, o2, .25 * s, vec3(.62, .69, .5), .9, 3.1, t, tooth);
  c = bloom(c, p, o3, (.17 + .01 * br) * s, vec3(.6, .74, .88), .9, 8.4, t, tooth);
  c = bloom(c, p, o4, .11 * s, u_c2, .8, 5.7, t, tooth);
  c = bloom(c, p, o1, (.36 + .012 * br) * s, u_c1, 1., 1.3, t, tooth);
  // a second, smaller glaze inside the clay bloom where pigment pooled
  c = bloom(c, p, o1 + vec2(-.06, .07) * s, .17 * s, u_c1 * vec3(.92, .86, .84), .55, 9.9, t, tooth);
  // ink lines, out of register with their washes
  float ink = inkline(p, o1 + vec2(.035, .028) * s, .35 * s, 4.2, t, px) + inkline(p, o3 + vec2(-.02, .02) * s, .16 * s, 6.6, t, px) * .9;
  // the wet drop that follows the brush while the pointer is over the hero
  c = bloom(c, p, m, .065 * (.8 + .2 * br) * s, u_c1, u_wet * .9, 12.7, t * 4., tooth);
  c = mix(c, u_c3, clamp(ink, 0., 1.) * .78);
  // dither so the low-res canvas never bands
  c += (hash21(fc + fract(t) * 37.) - .5) * (2. / 255.);
  gl_FragColor = vec4(c, 1.);
}`,
  },
  load: () => import("@/designs/clay"),
};
