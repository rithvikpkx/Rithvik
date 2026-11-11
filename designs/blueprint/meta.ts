import type { DesignMeta } from "../../lib/designs/types";

// Blueprint: the whole site as one cyanotype drawing set. The shader is the sheet itself (fixed, full screen): mottled
// Prussian-blue emulsion with cotton fibres, fold creases lit by a drafting lamp that leans toward the pointer, the
// sheet's curl at its edges. It moves with the page through `u_sy` (scroll in viewport heights, set by motion.ts), so
// the paper scrolls with the drawing instead of sitting behind it. No time term: the sheet is still unless touched.
export const META: DesignMeta = {
  id: "blueprint", name: "Blueprint", mood: "a drawing set, inked live", dark: true,
  keywords: ["blueprint","cyanotype","drafting","drawing","technical","architect","architecture","engineering","cad","plan","schematic","draft","blue"],
  swatch: ["#0F3E78","#EAF3FF","#7FC4FF","#FFB09A"],
  cardFont: "\"Barlow Condensed\", \"Arial Narrow\", sans-serif",
  fonts: "family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Architects+Daughter",
  shader: {
    colors: ["#103F79","#082650","#2A62A6","#EAF3FF"], scale: 0.5,
    source: `uniform float u_sy; // page scroll in viewport heights: the sheet travels with the drawing
// a fold: a soft valley (height -a at the crease); returns its slope at signed distance x
float fold(float x, float w){ return 2. * x / (w * w) * exp(-x * x / (w * w)); }
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  vec2 q = vec2(uv.x * asp, uv.y);                 // screen, y up, in viewport heights
  vec2 pg = vec2(q.x, 1. - uv.y + u_sy);           // the sheet, y down the page
  // uneven emulsion: cyanotype never coats evenly, so the blue mottles in broad clouds
  float cloud = vnoise(pg * 1.7) * .62 + vnoise(pg * 4.6 + 3.1) * .38;
  vec3 c = mix(u_c1, u_c0, .42 + .58 * cloud);
  // folded into panels: each panel aged a touch differently in the plan chest
  float py = pg.y / 1.45 + .38, pid = floor(py);
  float px = q.x - asp * .64;
  c *= 1. + (hash21(vec2(pid, step(0., px))) - .5) * .05;
  // fold creases (one vertical, one every panel down) and the sheet's curl at both edges, lit as a height field
  float fy = (fract(py) - .5) * 1.45;
  float ex = uv.x, cl = smoothstep(.05, 0., ex) - smoothstep(.95, 1., ex);
  vec2 slope = vec2(fold(px, .05) * .006 + cl * .28, -fold(fy, .045) * .006);
  vec3 n = normalize(vec3(-slope, 1.));
  // the drafting lamp: a broad pool high on the sheet that leans toward the pointer
  vec2 lp = vec2(mix(.7, u_mouse.x, .38) * asp, mix(.9, u_mouse.y, .32));
  vec3 l = normalize(vec3(lp - q, .55));
  float d = length(q - lp);
  float pool = exp(-d * d * 1.5);
  c = mix(c, u_c2, pool * .38);
  c *= 1. + 1.5 * (dot(n, l) - l.z);               // relief only: flat paper keeps its tone
  // worn creases: the emulsion cracks along a fold and shows a paler line
  c = mix(c, u_c3, (exp(-px * px * 9e4) + exp(-fy * fy * 9e4)) * .05);
  // cotton fibres and tooth
  float fib = vnoise(pg * vec2(16., 120.)) * .5 + vnoise(pg * vec2(120., 16.) + 7.) * .5;
  c += (fib - .5) * .036 * vec3(.75, .88, 1.);
  c = mix(c, u_c3, smoothstep(.8, .97, vnoise(pg * vec2(3., 70.) + 11.)) * .035);
  c += (hash21(fc) - .5) * .018;
  // light falloff toward the corners of the lamp's reach
  vec2 v = (uv - vec2(.55, .58)) * vec2(1., 1.15);
  c *= 1. - .42 * dot(v, v);
  gl_FragColor = vec4(c, 1.);
}`,
  },
  load: () => import("@/designs/blueprint"),
};
