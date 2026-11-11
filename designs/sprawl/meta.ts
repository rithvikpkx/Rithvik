import type { DesignMeta } from "../../lib/designs/types";

// Sprawl: a neon-noir megacity at three in the morning, seen through a rain-streaked window. The shader is the
// window: a hazy skyline with lit towers and neon signs, its wet street mirroring it, out-of-focus neon bokeh on the
// fogged glass, and drops sliding down that act as tiny lenses. The pointer wipes the glass clear along a trail
// (u_t0..u_t3, fed by motion.ts) and a click tears it with a short holo glitch (u_glitch).
const SHADER = `uniform vec3 u_t0; uniform vec3 u_t1; uniform vec3 u_t2; uniform vec3 u_t3; // wipe trail: hero uv, life 0..1
uniform float u_glitch; // 0..1, a horizontal tear pulsed on click

#define H .27
// the neon palette (u_c0 magenta, u_c1 cyan, u_c2 sodium amber, u_c3 violet), picked by a hash
vec3 neon(float h){ return h < .34 ? u_c0 : h < .64 ? u_c1 : h < .86 ? u_c2 : u_c3; }

// the city behind the glass at uv; s = how clear the glass is there (0 fogged, 1 wiped), which sharpens edges
vec3 city(vec2 uv, float s, float t, float asp){
  float wet = 0.;
  if (uv.y < H) { // wet asphalt: the city mirrored into the street, stretched and rippled
    float d = H - uv.y;
    wet = 1.;
    uv.y = H + d * 1.7 + .006 * snoise(vec2(uv.x * 30., d * 7. - t * .4));
    uv.x += .0015 * sin(d * 90. + t * 1.3);
  }
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 par = (u_mouse - .5) * .015;
  // sky: indigo overhead, smog lit magenta from below near the horizon, a faint teal band higher up
  vec3 col = mix(vec3(.06, .025, .12), vec3(.012, .01, .035), smoothstep(.3, 1., uv.y));
  col += u_c0 * .2 * exp(-pow((uv.y - H - .1) * 4.5, 2.));
  col += u_c1 * .045 * exp(-pow((uv.y - .68) * 3.5, 2.)) * (.6 + .4 * sin(p.x * 1.4 + 1.));
  // two slow searchlights raking the smog
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    vec2 o = vec2(asp * (.3 + .45 * fk), H);
    float a = .35 * sin(t * (.11 + fk * .05) + fk * 2.4) + (fk - .5) * .5;
    vec2 dir = vec2(sin(a), cos(a)), q = p - o;
    float along = dot(q, dir), across = abs(dot(q, vec2(dir.y, -dir.x)));
    col += mix(u_c1, vec3(.8, .85, 1.), .5) * .07 * exp(-across * across / (.0004 + along * .004)) * step(0., along) * exp(-along * 1.2);
  }
  // three rows of towers, far to near: wider, taller and darker as they come forward
  float b = mix(.03, .002, s); // edge softness: fogged glass blurs the skyline
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float w = mix(.045, .13, fi * .5);
    float x = p.x + par.x * (fi + 1.) * 3. + fi * 7.31;
    float id = floor(x / w), f = fract(x / w);
    float r = hash21(vec2(id, fi));
    float top = H + mix(.08, .2, fi * .5) + r * r * mix(.16, .42, fi * .5);
    float gap = .07 + .1 * hash21(vec2(id, fi + 9.));
    float m = (1. - smoothstep(top - b, top + b, uv.y)) * smoothstep(gap - b * 3., gap + b * 3., f) * (1. - smoothstep(1. - gap - b * 3., 1. - gap + b * 3., f));
    vec3 tc = mix(vec3(.1, .055, .17), vec3(.016, .012, .032), fi * .5);
    // windows: a grid of soft cells, most dark, a few lit warm or cold, one in a while blinking
    vec2 wc = vec2((f - gap) / (1. - 2. * gap) * mix(5., 9., fi * .5), uv.y * mix(70., 46., fi * .5));
    vec2 wi = floor(wc), wf = fract(wc) - .5;
    float lit = step(.86 - .04 * fi, hash21(wi + id * 13.1 + fi * 3.7)) * step(uv.y, top - .015);
    lit *= step(.04, fract(hash21(wi + id) * 91. + t * .07 * hash21(wi.yx + id)));
    float cell = mix(.32, (1. - smoothstep(.16, .36, abs(wf.x))) * (1. - smoothstep(.18, .38, abs(wf.y))), s); // fogged: a soft wash
    vec3 wcol = mix(vec3(1., .72, .38), vec3(.55, .85, 1.), step(.6, hash21(wi * 1.3 + id)));
    tc += wcol * lit * cell * mix(.22, .7, fi * .5);
    // a vertical neon sign on some towers, buzzing now and then
    float sh = hash21(vec2(id + 4.2, fi * 2.1));
    float sx = gap + .12, sy0 = top - .26, sy1 = top - .05;
    float on = step(.5, sh) * step(.06, fract(sin(floor(t * 14.) + id * 7.) * 43758.5)) * step(.5, fi);
    float dx = abs(f - sx) * w, dy = max(0., max(sy0 - uv.y, uv.y - sy1));
    float sd = length(vec2(dx, dy));
    vec3 nc = neon(fract(sh * 7.3));
    tc = mix(tc, nc * 1.4 + .3, on * (1. - smoothstep(.0025, .0045 + b * .2, sd)));
    col = mix(col, tc, m);
    col += nc * on * .05 * exp(-sd * 38.); // its light bleeds into the haze
    col = mix(col, vec3(.09, .045, .14), .16 * (1. - fi * .5)); // smog between rows
  }
  // a flyer crossing far off: a red and a white light, blinking
  vec2 fly = vec2(fract(t * .018) * (asp + .4) - .2, .78 + .04 * sin(t * .3));
  col += vec3(1., .25, .3) * step(.5, fract(t * 1.3)) * .9 * exp(-length(p - fly) * 260.);
  col += vec3(.9) * .7 * exp(-length(p - fly - vec2(.012, 0.)) * 300.);
  // the street: darker, wet, with vertical streaks pulled out of every light
  if (wet > .5) col *= .38 + .2 * snoise(vec2(uv.x * 70., uv.y * 3.));
  return col;
}

// out-of-focus neon on the fogged glass: soft discs with a brighter rim, drifting
vec3 bokeh(vec2 p, float t, float c, float seed){
  vec2 g = (p + vec2(0., t * .006)) / c, id = floor(g), q = fract(g) - .5;
  float h = hash21(id + seed);
  vec2 o = (vec2(hash21(id + seed + 3.), hash21(id + seed + 5.)) - .5) * .32;
  float r = .12 + .14 * hash21(id + seed + 9.), d = length(q - o);
  float disc = (1. - smoothstep(r - .06, r, d)) * (.65 + .35 * smoothstep(r - .08, r - .02, d));
  return neon(fract(h * 5.7)) * disc * step(.8, h) * (.3 + .7 * hash21(id + seed + 11.)) * (1. - smoothstep(.35, .95, p.y));
}

// one layer of drops sliding down the glass: xy = refraction offset, z = lens mask, w = the clear trail behind it
vec4 drops(vec2 p, float t, float n){
  vec2 st = p * vec2(n, n * .5), id = floor(st), f = fract(st) - .5;
  vec2 dd = vec2(f.x, f.y * 2.);
  float h = hash21(id), h2 = hash21(id + 1.7);
  float ph = fract(t * (.05 + .07 * h) + h * 7.);
  float y = .9 - 1.8 * ph * ph * (3. - 2. * ph);
  float x = (h2 - .5) * .6 + .05 * sin(y * 7. + h * 20.);
  vec2 dv = (dd - vec2(x, y)) * vec2(1., 1.3);
  float lens = (1. - smoothstep(.1, .13, length(dv))) * step(.3, h2);
  float tr = (1. - smoothstep(.025, .06, abs(dd.x - x))) * smoothstep(y, y + .06, dd.y) * (1. - smoothstep(y + .1, 1., dd.y)) * step(.35, h2);
  // beads left behind in the trail
  float by = (fract(dd.y * 4. + h) - .5) * .25;
  float bead = (1. - smoothstep(.018, .03, length(vec2(dd.x - x, by)))) * tr;
  vec2 off = -dv * lens * 6. - vec2(dd.x - x, by) * bead * 8.;
  return vec4(off, max(lens, bead), tr);
}

float wipeAt(vec2 p, vec3 w, float asp){ return w.z * (1. - smoothstep(.05, .12, length(p - vec2(w.x * asp, w.y)))); }

void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.15, asp);
  // holo tear: a few rows slip sideways while the glitch pulse lasts
  float row = floor(uv.y * 26.), tear = step(.8, hash21(vec2(row, floor(t * 24.)))) * u_glitch;
  uv.x += tear * (hash21(vec2(row, 3.)) - .5) * .08;
  vec2 p = vec2(uv.x * asp, uv.y);

  // the visitor's hand wipes the condensation off along its trail
  float wipe = max(max(wipeAt(p, u_t0, asp), wipeAt(p, u_t1, asp)), max(wipeAt(p, u_t2, asp), wipeAt(p, u_t3, asp)));
  vec4 d1 = drops(p, t, 5.), d2 = drops(p * 1.6 + 3.1, t * 1.15, 5.);
  // fine condensation beads
  vec2 sg = p * 46., sid = floor(sg), sq = fract(sg) - .5;
  float sh = hash21(sid);
  vec2 so = (vec2(hash21(sid + 2.), hash21(sid + 4.)) - .5) * .4;
  float sm = (1. - smoothstep(.1, .2 + .12 * sh, length(sq - so))) * step(.72, sh) * sin(3.14159 * fract(t * .03 + sh * 9.));
  float keep = 1. - wipe;
  vec2 off = (d1.xy + d2.xy * .7 - (sq - so) * sm * .8) * keep;
  float lens = max(max(d1.z, d2.z), sm) * keep;
  float clear = max(max(lens, max(d1.w, d2.w) * .75), wipe);

  vec3 col = city(uv + off * .09, clear, t, asp);
  col += (bokeh(p + off * .3, t, .16, 0.) + bokeh(p + off * .3, t * 1.3, .27, 17.) * .8) * (1. - clear) * .55;
  // fogged glass scatters the city into a soft lilac veil
  col = mix(col, vec3(.08, .05, .13) + col * .55, .55 * (1. - clear));
  // each drop lights up like a lens, brightest along its lower rim
  col *= 1. + lens * .7;
  col += lens * smoothstep(.1, .5, off.y) * vec3(.1, .12, .18); // the lower rim catches the street light
  col *= 1. - lens * smoothstep(.3, .7, -off.y) * .5; // the upper rim reads dark
  col += tear * vec3(.25, -.05, .2) * .6; // the tear splits colour

  // keep the copy column calm and dark on wide screens, then sink into the page at the hero's foot
  float calm = wide > .5 ? mix(.3, 1., smoothstep(.3, .66, uv.x)) : mix(.5, 1., smoothstep(.62, .32, uv.y));
  col *= calm;
  col = mix(vec3(.027, .024, .058), col, smoothstep(.0, .2, uv.y) * mix(1., .6, smoothstep(0., .12, u_scroll)));
  col += (hash21(fc + fract(t * 7.3) * 91.) - .5) * .022; // film grain
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;

export const META: DesignMeta = {
  id: "sprawl", name: "Sprawl", mood: "neon rain on the window", dark: true,
  keywords: ["sprawl", "cyberpunk", "neon", "noir", "rain", "city", "night", "megacity", "hologram", "glitch", "blade", "synthwave", "future"],
  swatch: ["#07060F", "#05D9E8", "#FF2A6D", "#FFB547"],
  cardFont: "\"Big Shoulders Display\", \"Arial Narrow\", sans-serif",
  fonts: "family=Big+Shoulders+Display:wght@500..900&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400..600",
  shader: { colors: ["#FF2A6D", "#05D9E8", "#FFB547", "#7B2CFF"], scale: 0.5, host: "#sp-city", source: SHADER },
  load: () => import("@/designs/sprawl"),
};
