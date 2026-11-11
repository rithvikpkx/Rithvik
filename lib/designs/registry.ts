import type { DesignMeta } from "./types";

// Metadata and shaders copied from each docs/mockups/v7/themes/<id>.js V6.theme({...}) call.
// Order = dial / `T` order. Each `load` is its own lazy chunk (the design's markup + CSS).
export const DESIGNS: DesignMeta[] = [
  {
    id: "nimbus", name: "Nimbus", mood: "pixel clouds, your sky", dark: false,
    keywords: ["nimbus","cloud","clouds","sky","pixel","pixels","blue","weather","airy","light","sunny","playful"],
    swatch: ["#E6F4FF","#0E1B2B","#0A9BFF","#FFC93C"],
    cardFont: "\"Fraunces\", Georgia, serif",
    fonts: "family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..600,100;1,9..144,300..600,100",
    shader: {
      colors: ["#FFFFFF","#C4E6FF","#6CC4FF","#0A9BFF"], scale: 0.35, host: "#nb-sky",
      source: `#define SUN vec2(.5, .8)
#define NIGHT 0.
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
void main(){
  // integer canvas pixels per dither cell keeps every block crisp; 4×4 cells make one cloud block
  float fine = max(1., floor(u_res.y / 190. + .5));
  vec2 f = floor(gl_FragCoord.xy / fine);
  vec2 blk = floor(f / 4.);
  float asp = u_res.x / u_res.y;
  vec2 uv = (blk * 4. + 2.) * fine / u_res;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float t = u_time;
  vec2 d = p - m; float r2 = dot(d, d);
  // clouds slide away from the pointer, then a little hole of open sky follows it
  vec2 q = p + d * exp(-r2 * 8.) * .5;
  q = q * 1.2 + vec2(t * .016, u_scroll * .9);
  float n = fbm(q);
  float n2 = fbm(q * 2.4 + vec2(3.7, t * .012));
  float w = .44 + .72 * n + .2 * n2;
  // a clearing for the headline, sized to the screen's shape
  float rx = mix(.52, .36, smoothstep(.7, 1.5, asp));
  float tall = 1. - smoothstep(.7, 1.2, asp);
  vec2 e = (uv - vec2(.5, .48)) / vec2(rx, mix(.27, .36, tall));
  w += (1. - smoothstep(.62, 1.2, length(e))) * 1.2;
  w -= exp(-r2 * 30.) * .85;
  // on tall screens the sun climbs above the headline and shrinks a little
  vec2 sp = vec2(SUN.x * asp, mix(SUN.y, .855, tall));
  float sd = length(p - sp) / mix(1., .62, tall);
  w -= exp(-sd * sd * 50.) * .4;
  // dissolve into the white page below
  w += smoothstep(.2, .02, uv.y) * 1.4;
  w = clamp(w, 0., .999);
  // four tones; each block picks a pair and an ordered-dither ratio (solid, sparse, checker)
  float x = w * 3.; float lo = floor(x); float fr = x - lo;
  fr = fr < .3 ? 0. : (fr < .48 ? .25 : (fr < .72 ? .5 : 1.));
  float tone = lo + step(bayer4(f) + .001, fr);
  vec3 c = tone < .5 ? u_c3 : (tone < 1.5 ? u_c2 : (tone < 2.5 ? u_c1 : u_c0));
  float sky = step(tone, 1.5);
  float core = step(sd, .058);
  float halo = step(sd, .098) * (1. - core) * step(bayer4(f), .45);
  if (NIGHT > .5) {
    float moon = step(sd, .058);
    float shade = step(length(p - sp - vec2(.03, .012) * mix(1., .62, tall)) / mix(1., .62, tall), .05) * step(bayer4(f), .62);
    c = mix(c, vec3(.62, .68, .93), halo * sky * .6);
    c = mix(c, mix(vec3(1., .965, .86), vec3(.78, .8, .93), shade), moon * sky);
    float h = hash21(blk);
    vec2 cell = mod(f, 4.);
    float star = step(.972, h) * step(abs(cell.x - 1.), .1) * step(abs(cell.y - 2.), .1) * step(tone, .5);
    star *= step(-.2, sin(t * 1.6 + h * 60.));
    c = mix(c, vec3(1.), star);
  } else {
    c = mix(c, vec3(1., .905, .64), halo * sky);
    c = mix(c, vec3(1., .79, .235), core * sky);
  }
  gl_FragColor = vec4(c, 1.);
}`,
    },
    load: () => import("@/designs/nimbus"),
  },
  {
    id: "stipple", name: "Stipple", mood: "breath on cold glass", dark: false,
    keywords: ["stipple","pamphlet","print","printed","paper","peach","dots","ink","riso","zine","tender"],
    swatch: ["#F9CDB0","#17110E","#FF3B1F","#2B44B8"],
    cardFont: "\"Instrument Serif\", Georgia, serif",
    fonts: "family=Instrument+Serif:ital@0;1&family=Martian+Mono:wght@300..700",
    shader: {
      colors: ["#F9CDB0","#17110E","#FF3B1F","#2B44B8"], scale: 0.5,
      source: `float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float t = u_time;
  // the cloud parts around the pointer: push the domain outward, then clear a soft hollow
  vec2 dm = p - m; float r2 = dot(dm, dm);
  p += dm * exp(-r2 * 6.) * .7;
  float hollow = exp(-r2 * 34.);
  float breath = .5 + .5 * sin(t * .42);
  vec2 sp = p * 1.05 + vec2(0., -u_scroll * 2.6);
  vec2 q = vec2(fbm(sp + vec2(0., t * .035)), fbm(sp + vec2(5.2, 1.3) + vec2(t * .028, 0.)));
  float n = fbm(sp * 1.35 + 1.8 * q + vec2(1.7, 9.2) - vec2(t * .012, t * .018));
  // ink density follows the chapters: heavy on the cover, thinning and returning as you read
  float chap = .5 + .5 * cos(u_scroll * 6.2832 * 2.5);
  float d = smoothstep(-.02, .78, n + .16 * breath - .1 + .16 * chap);
  d = d * d * (.5 + .5 * chap) * .8;
  float col = (1. - smoothstep(.15, .34, abs(uv.x - .5))) * smoothstep(1.05, 1.45, asp);
  d *= 1. - .4 * col;
  d *= 1. - .92 * hollow;
  float th = ign(fc);
  float ink = step(th, d * .86);
  // second plate: vermilion, sparse, misregistered from the ink so it reads like a riso overprint
  float dv = smoothstep(.05, .7, q.y + .45 * n - .1) * smoothstep(.02, .35, d);
  float ver = step(ign(fc + vec2(23., 7.)), dv * (.16 + .16 * breath) * (1. - hollow));
  // a faint ring of blue dots where the pointer breathes on the glass
  float rr = sqrt(r2);
  float ring = exp(-pow((rr - .085 - .01 * breath) * 60., 2.)) * .12;
  float blu = step(ign(fc + vec2(61., 113.)), ring);
  // paper: warm fibres and a fixed grain so the low-res canvas reads as stock, not blur
  float fib = vnoise(fc * vec2(.7, .06) + 3.1);
  vec3 c = u_c0 * (1. + .028 * (fib - .5)) + (hash21(fc) - .5) * .022;
  c = mix(c, u_c3, blu * .85);
  c = mix(c, u_c2, ver * .92);
  c = mix(c, u_c1, ink * .92);
  gl_FragColor = vec4(c, 1.);
}`,
    },
    load: () => import("@/designs/stipple"),
  },
  {
    id: "glyph", name: "Glyph", mood: "a machine dreaming in text", dark: true,
    keywords: ["terminal","tui","ascii","glyph","mono","monospace","vim","tmux","hacker","command line","cli","halftone","dither"],
    swatch: ["#050505","#EDEDED","#FFC400","#3BA4FF"],
    cardFont: "\"Martian Mono\", ui-monospace, monospace",
    fonts: "family=Martian+Mono:wdth,wght@75..112.5,100..800&family=Spline+Sans+Mono:ital,wght@0,300..700;1,300..700",
    shader: {
      colors: ["#EDEDED","#FFC400","#3BA4FF","#FF2D2D"], scale: 0.5,
      source: `float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
float gyr(vec3 p){ return dot(sin(p), cos(p.yzx)); }
mat3 rY(float a){ float c = cos(a), s = sin(a); return mat3(c, 0., s, 0., 1., 0., -s, 0., c); }
mat3 rX(float a){ float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, -s, 0., s, c); }
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }

/* cortex: a liquid ellipsoid folded along a gyroid labyrinth (sulci), split by a fissure */
float cortex(vec3 p, float t, out float sul){
  vec3 q = p + .075 * sin(p.yzx * 2.4 + t * .4) + .03 * sin(p.zxy * 5.3 - t * .33);
  q.y *= q.y < 0. ? 1.25 : 1.;
  vec3 r = vec3(.68, .6, .88);
  float k0 = length(q / r), k1 = length(q / (r * r));
  float e = k0 * (k0 - 1.) / k1;
  vec3 cq = q - vec3(0., -.36, .5);
  float cb = (length(cq / vec3(.46, .2, .3)) - 1.) * .2;
  float hh = clamp(.5 + .5 * (cb - e) / .12, 0., 1.);
  e = mix(cb, e, hh) - .12 * hh * (1. - hh);
  float G = gyr(q * 11. + vec3(0., t * .1, t * .06));
  sul = exp(-G * G * 3.);
  float fis = exp(-q.x * q.x * 300.) * smoothstep(-.3, .2, q.y);
  return e + .05 * sul + .09 * fis;
}

/* ASCII for the crumbling edge; g spans x [-.3,.3], y [-.5,.5] */
float glyph(float id, vec2 g, float w){
  float d = 1e3;
  if (id < 1.5) return length(g - vec2(0., -.22)) - .08;
  if (id < 2.5) return min(length(g - vec2(0., -.22)), length(g - vec2(0., .14))) - .08;
  if (id < 3.5) return seg(g, vec2(-.2, 0.), vec2(.2, 0.)) - w;
  if (id < 4.5) return min(seg(g, vec2(-.2, -.11), vec2(.2, -.11)), seg(g, vec2(-.2, .11), vec2(.2, .11))) - w;
  if (id < 5.5) return min(seg(g, vec2(-.2, 0.), vec2(.2, 0.)), seg(g, vec2(0., -.22), vec2(0., .22))) - w;
  if (id < 6.5) { d = seg(g, vec2(0., -.22), vec2(0., .22)); d = min(d, seg(g, vec2(-.19, -.11), vec2(.19, .11))); return min(d, seg(g, vec2(-.19, .11), vec2(.19, -.11))) - w; }
  if (id < 7.5) { d = seg(g, vec2(-.07, -.3), vec2(-.1, .3)); d = min(d, seg(g, vec2(.11, -.3), vec2(.08, .3))); d = min(d, seg(g, vec2(-.22, -.1), vec2(.22, -.1))); return min(d, seg(g, vec2(-.22, .12), vec2(.22, .12))) - w; }
  if (id < 8.5) return seg(g, vec2(-.2, -.36), vec2(.2, .36)) - w;
  return seg(g, vec2(-.2, .36), vec2(.2, -.36)) - w;
}

void main(){
  float t = u_time, s = u_scroll;
  vec2 fc = gl_FragCoord.xy;
  float cs = max(5., floor(u_res.y / 122.));
  vec2 cell = floor(fc / cs);
  vec2 f = (fc - cell * cs) / cs - .5;
  vec2 cc = (cell + .5) * cs;
  vec2 uv = cc / u_res;
  float asp = u_res.x / u_res.y, wide = step(1.05, asp), px = 1. / cs;
  vec2 p = (cc - .5 * u_res) / u_res.y;

  // section hue from scroll: amber (top, work), blue (log, man), red (bin, mail)
  vec3 H1 = mix(mix(u_c1, u_c2, smoothstep(.31, .38, s)), u_c3, smoothstep(.79, .86, s));
  vec3 H2 = mix(mix(u_c2, u_c3, smoothstep(.31, .38, s)), u_c1, smoothstep(.79, .86, s));

  // the mouse parts the dots like a hand through water
  vec2 mo = u_mouse - .5;
  float hasM = step(.0015, length(mo));
  vec2 dv = p - mo * vec2(asp, 1.);
  float md = length(dv);
  p += dv / (md + 1e-4) * hasM * .07 * exp(-md * md * 26.);

  // placement: centre-right in the hero, half off the right edge in the sections, centre for the finale
  float side = smoothstep(.04, .14, s);
  float fin = 0.;
  float calm = mix(mix(.5, .3, side), mix(1., .75, side), wide);
  vec2 ctr = wide > .5 ? vec2(mix(mix(asp * .16 + .04, asp * .5 - .06, side), 0., fin), mix(mix(.07, -.02, side), .02, fin)) : vec2(mix(0., asp * .5 - .02, side), mix(.1, .05, side));
  float fl = wide > .5 ? mix(1.12, 1.6, side) * mix(1., .86, fin) : mix(.86, 1.05, side);
  vec2 q = p - ctr;

  float yaw = 1.15 + t * .07 + s * 4.6 + mo.x * .7;
  float pit = -.32 + mo.y * .35 + .07 * sin(t * .19);
  mat3 R = rY(yaw) * rX(pit);
  vec3 ro = R * vec3(0., 0., -3.), rd = R * normalize(vec3(q, fl));

  float hit = 0., sul = 0.;
  vec3 po = vec3(0.);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.02, h = b * b - c;
  if (h > 0.) {
    float tt = -b - sqrt(h), tmax = -b + sqrt(h);
    for (int i = 0; i < 40; i++) {
      po = ro + rd * tt;
      float d = cortex(po, t, sul);
      if (d < .0025) { hit = 1.; break; }
      tt += d * .78;
      if (tt > tmax) break;
    }
  }

  vec3 col = vec3(.0196);
  float cov = 0.;
  vec3 ink = vec3(0.);

  if (hit > .5) {
    float du; vec2 k = vec2(1., -1.) * .004;
    vec3 n = normalize(k.xyy * cortex(po + k.xyy, t, du) + k.yyx * cortex(po + k.yyx, t, du) + k.yxy * cortex(po + k.yxy, t, du) + k.xxx * cortex(po + k.xxx, t, du));
    vec3 nW = n * R;
    vec3 rdW = normalize(vec3(q, fl));
    float dif = max(dot(nW, normalize(vec3(-.55, .7, -.55))), 0.);
    float fres = 1. - max(dot(nW, -rdW), 0.);
    float pulse = smoothstep(.88, 1., sin(dot(po, vec3(.15, 1., .4)) * 6.5 - t * 1.25)) * (.35 + .65 * sul);
    float lum = clamp(.04 + .95 * pow(dif, 1.2) * (1. - .8 * sul) + .3 * fres * fres + .45 * pulse, 0., 1.);
    // edge crumble: the rim breaks into drifting ASCII and missing pixels
    float cr = smoothstep(.45, .97, fres);
    float rnd = hash21(cell + floor(t * 2.2) * 7.31);
    if (rnd < cr * .42) {
      cov = 0.;
    } else if (rnd < cr * .8) {
      float id = 1. + floor(hash21(cell * 1.3 + floor(t * 3.)) * 8.99);
      cov = 1. - smoothstep(-px, px, glyph(id, f * 1.1, .07));
      ink = mix(H1, vec3(1.), .25) * (.45 + .5 * lum);
    } else {
      float sz = sqrt(lum) * .94;
      if (lum < .22) sz = bayer4(cell) < lum * 4.6 ? .3 : 0.;
      float dd = max(abs(f.x), abs(f.y)) - sz * .5;
      cov = 1. - smoothstep(-px * .5, px * .5, dd);
      ink = mix(vec3(.93), H1, pulse * .85) * (.42 + .62 * lum);
    }
    ink *= calm;
  } else {
    // background: a fluid field swelling a regular grid of tiny square dots
    float nb = fbm(cell * vec2(.03, .03) + vec2(t * .03, -t * .045));
    float fl2 = smoothstep(.05, .8, nb);
    float sz = .12 + .3 * fl2;
    float dd = max(abs(f.x), abs(f.y)) - sz * .5;
    cov = (1. - smoothstep(-px * .5, px * .5, dd)) * step(.5, mod(cell.x + cell.y, 2.) + fl2 * 2.);
    ink = mix(vec3(.6), H1, .2 * fl2) * (.12 + .18 * fl2);

    // a few columns where text falls through the dark
    float hc = hash21(vec2(cell.x, 7.13));
    if (hc < .035 - .02 * side) {
      float rows = u_res.y / cs;
      float head = fract(t * (.02 + hc * .9) + hc * 17.) * (rows + 30.);
      float dist = head - (rows - cell.y);
      if (dist > 0. && dist < 18.) {
        float tr = 1. - dist / 18.;
        float id = 1. + floor(hash21(cell + floor(t * 9.)) * 8.99);
        cov = 1. - smoothstep(-px, px, glyph(id, f * 1.1, .07));
        ink = mix(H1 * .8, vec3(1.), step(dist, 1.)) * (.12 + .5 * tr * tr);
      }
    }
  }

  // orbit: a tilted dotted band of signal; its far half passes behind the cortex
  float tl = .3;
  vec2 rq = mat2(cos(tl), sin(tl), -sin(tl), cos(tl)) * q;
  float K = 3.6, rad = .62 / fl * 1.2;
  float rr = length(rq * vec2(1., K));
  float rdist = abs(rr - rad) * rr / max(length(vec2(rq.x, K * K * rq.y)), 1e-4);
  if (rdist < .55 * cs / u_res.y && (rq.y < 0. || hit < .5)) {
    float an = atan(rq.y * K, rq.x);
    float pk = pow(.5 + .5 * sin(an * 3. - t * 1.1), 10.);
    float sz = .34 + .5 * pk;
    cov = 1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - sz * .5);
    ink = mix(H2 * .6, mix(H2, vec3(1.), .35), pk) * (.6 + .5 * pk) * calm;
  }

  // boot: the page assembles from static, top first, behind a luminous front
  float boot = smoothstep(.15, 2.7, t);
  float rv = hash21(cell + 3.1) * .4 + (1. - uv.y) * .6;
  if (rv > boot * 1.04) {
    float on = step(hash21(cell * 1.7 + floor(t * 14.)), .45);
    cov = (1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - .16)) * on;
    ink = vec3(.4);
  } else {
    float front = smoothstep(.06, 0., boot * 1.04 - rv) * (1. - boot * .7);
    ink = mix(ink, H1 * 1.1, front);
    cov = max(cov, front * (1. - smoothstep(-px * .5, px * .5, max(abs(f.x), abs(f.y)) - .3)));
  }

  col += ink * cov;
  col *= 1. - .38 * pow(length(uv - .5) * 1.2, 2.2);
  col += (hash21(fc + fract(t * 7.3) * 91.) - .5) * .026;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
    },
    load: () => import("@/designs/glyph"),
  },
  {
    id: "prism", name: "Prism", mood: "light, split", dark: false,
    keywords: ["prism","light","spectrum","rainbow","glass","optics","optical","refraction","crystal","caustics","white","clean","ethereal"],
    swatch: ["#F4F5F8","#0B0B0F","#FF3B5C","#00B4FF"],
    cardFont: "\"Instrument Sans\", system-ui, sans-serif",
    fonts: "family=Instrument+Sans:ital,wdth,wght@0,75..100,400..700;1,75..100,400..700&family=IBM+Plex+Mono:wght@400;500",
    shader: {
      colors: ["#FFFFFF","#0B0B0F","#E8EBF1","#5B3CFF"], scale: 0.6, host: "#pr-gl",
      source: `#define TAU 6.2831853
uniform vec2 u_pc; // the portrait's centre in 0..1 screen units (y up); the prism is built around it
uniform float u_pr; // the prism's circumradius in screen heights (0 = not measured yet: use the default stage)
vec3 hue(float h){ return clamp(abs(mod(h * 6. + vec3(0., 4., 2.), 6.) - 3.) - 1., 0., 1.); }
// visible spectrum: 0 = red, 1 = violet, softened so it reads like light falling on paper
vec3 spec(float x){ vec3 c = hue(x * .79); return mix(c, vec3(1.), .08); }
// iterated-trig caustic net (cheap, no noise)
float caust(vec2 p, float t){
  vec2 i = p; float c = 1.;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1. - 3.5 / float(n + 1));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + tt) / .005), p.y / (cos(i.y + tt) / .005)));
  }
  c = 1.17 - pow(c / 4., 1.4);
  return clamp(pow(abs(c), 8.), 0., 1.);
}
float sdTri(vec2 p, float r){ const float k = 1.7320508; p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.; p.x -= clamp(p.x, -2. * r, 0.); return -length(p) * sign(p.y); }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float segd(vec2 p, vec2 a, vec2 b, out float h){ vec2 pa = p - a, ba = b - a; h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float px = 1. / u_res.y;
  float t = u_time;
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float tall = 1. - smoothstep(.75, 1.2, asp);
  // the prism is the first screen; it is gone by the time the first section has slid over it
  float F = 1. - smoothstep(.02, .14, u_scroll);

  // paper: white, with a cool breath of mist where the prism stands
  vec3 col = u_c0;
  vec2 C = mix(vec2(asp * .69, .5), vec2(asp * .5, .215), tall);
  float R = mix(.2, .145, tall);
  if (u_pr > 0.) { C = vec2(u_pc.x * asp, u_pc.y); R = u_pr; } // centred on the photo: the triangle's centroid is its incircle's centre
  float vign = exp(-dot(p - C, p - C) * mix(1.6, 3.2, tall));
  col = mix(col, u_c2, F * (.42 + .58 * vign));

  // caustics: three channels sampled a little apart, so the net breaks into a faint rainbow
  float w = fbm(p * .85 + vec2(t * .018, -u_scroll * 1.6));
  float patchy = smoothstep(-.3, .55, w);
  vec2 cp = p * 5.5 + vec2(-250., -250. + u_scroll * 6.);
  float ct = t * .3 + 40.;
  vec2 dk = vec2(.11, .05);
  vec3 cv = vec3(caust(cp + dk, ct), caust(cp, ct), caust(cp - dk, ct));
  float avg = (cv.r + cv.g + cv.b) / 3.;
  // on white paper light can only show as colour: the channels that run ahead tint the line, a whisper of shade around it
  float amt = mix(.4, .14, F) * patchy;
  col = clamp(col + (cv - avg) * amt * 1.6 - (1. - avg) * amt * .045, 0., 1.);

  // prism, local frame: apex up, a slow sway, a nudge from the pointer and the scroll
  float a0 = .022 * sin(t * .23) + (u_mouse.x - .5) * .04 + u_scroll * 1.6; // a gentle sway: the photo stays visibly centred
  vec2 q = rot(p - C, -a0);
  float d = sdTri(q, R);
  vec2 T = vec2(0., 2. * R / 1.7320508), BL = vec2(-R, -R / 1.7320508), BR = vec2(R, -R / 1.7320508);
  vec2 A = C + rot(mix(BL, T, .66), a0), E = C + rot(mix(T, BR, .34), a0); // the inner beam crosses above the photo, not behind it
  float inside = 1. - smoothstep(-px, px, d);

  // incident beam: a hairline of white light falling from the top
  vec2 vIn = normalize(mix(vec2(.62, -1.), vec2(.42, -1.), tall));
  vec2 wa = p - A;
  float along = dot(wa, -vIn), perp = abs(wa.x * vIn.y - wa.y * vIn.x);
  float beam = step(0., along) * (1. - inside) * (exp(-pow(perp / (1.25 * px), 2.)) + .32 * exp(-perp / (16. * px)));
  col = mix(col, vec3(1.), clamp(beam, 0., 1.) * F);
  // the faint reflection off the first face
  vec2 vR = normalize(vec2(-1., .2));
  float alR = dot(wa, vR), peR = abs(wa.x * vR.y - wa.y * vR.x);
  col = mix(col, vec3(1.), step(0., alR) * exp(-alR * 7.) * exp(-pow(peR / (1.1 * px), 2.)) * .4 * F * (1. - inside));

  // dispersion fan: rays leave the far face, red bent least, aimed toward the pointer
  vec2 e = p - E; float r = length(e);
  vec2 tm = m - E;
  float target = clamp(atan(tm.y, max(tm.x, .3)), -1.0, .42);
  float phi = mix(mix(-.3, target, .8), -.62, tall);
  float spread = .42 + .05 * sin(t * .4);
  float ang = atan(e.y, e.x);
  float x = (ang - phi) / spread + .5;
  float lam = 1. - x;
  float edgeF = smoothstep(0., .07, x) * smoothstep(1., .93, x);
  float streak = .8 + .2 * vnoise(vec2(x * 70., r * 5. - t * .3));
  float fall = smoothstep(0., 10. * px, r) * (.6 + .4 * exp(-r * 1.1));
  float fan = edgeF * fall * streak * step(0., d) * F;
  col = mix(col, col * spec(clamp(lam, 0., 1.)), fan * .9);
  col = mix(col, vec3(1.), fan * exp(-r * 9.) * .25);

  // glass: a cool, slightly brighter body; refracted caustics; the beam inside widening as it splits
  vec3 glass = mix(col, vec3(.985, .99, 1.), .55);
  float h; float sd = segd(p, A, E, h);
  float wid = mix(1.3, 7., h) * px;
  vec2 sn = normalize(vec2(A.y - E.y, E.x - A.x));
  vec3 inner = mix(vec3(1.), spec(clamp(.5 - .5 * dot(p - mix(A, E, h), sn) / wid, 0., 1.)), smoothstep(.35, 1., h) * .7);
  glass = mix(glass, inner, exp(-pow(sd / wid, 2.)) * .9);
  glass *= 1. - .035 * smoothstep(-R * .9, 0., d);
  col = mix(col, glass, inside * F);
  // edges: a graphite hairline, a white inner highlight, a dispersed fringe just outside
  float edge = 1. - smoothstep(.0, 1.15 * px, abs(d));
  float hl = exp(-pow((d + 3. * px) / (1.1 * px), 2.));
  float fr = exp(-pow((d - 2. * px) / (1.1 * px), 2.));
  vec3 fringe = spec(fract(atan(q.y, q.x) / TAU + t * .02));
  col = mix(col, col * fringe, fr * .22 * F);
  col = mix(col, vec3(1.), hl * .85 * F);
  col = mix(col, u_c1, edge * .62 * F);
  // a second, inner reflection of the faces
  float d2 = sdTri(q, R * .9);
  col = mix(col, vec3(1.), (1. - smoothstep(0., 1.1 * px, abs(d2))) * .5 * F);

  // grain: the capped resolution reads as fine texture, never as blur
  col += (hash21(fc + fract(t * 7.3) * 91.) - .5) * (2.2 / 255.);
  gl_FragColor = vec4(col, 1.);
}`,
    },
    load: () => import("@/designs/prism"),
  },
  {
    id: "mercury", name: "Mercury", mood: "liquid chrome, slow and heavy", dark: true,
    keywords: ["mercury","chrome","metal","liquid","quicksilver","silver","ferrofluid","luxury","dark","mirror","reflective"],
    swatch: ["#0A0A0B","#EDEDEF","#B9BCC4","#B9C8FF"],
    cardFont: "\"Bodoni Moda\", Didot, Georgia, serif",
    fonts: "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..800;1,6..96,400..800&family=Hanken+Grotesk:wght@300..700",
    shader: {
      colors: ["#0A0A0B","#E8EEFF","#FFE6D2","#B9C8FF"], scale: 0.75, host: "#mc-gl",
      source: `#define PI 3.14159265
float box2(vec2 q, vec2 h, float s){ vec2 d = abs(q) - h; return smoothstep(s, 0., max(d.x, d.y)); }
float wrapA(float a){ return mod(a + PI, 2. * PI) - PI; }
// the studio the metal reflects: dark room, warm floor bounce, a bright horizon sweep, a cool key softbox,
// a warm strip light, an overhead panel and a fill behind the camera (which the centre of a droplet sees)
vec3 env(vec3 r, float spin){
  float ph = atan(r.x, -r.z) + spin; float y = clamp(r.y, -1., 1.);
  vec3 c = mix(u_c0 * 1.2, mix(vec3(.2, .195, .19), vec3(.07, .068, .066), smoothstep(-.25, -.9, y)), smoothstep(.04, -.2, y));
  float fr = cos(ph * .5); fr *= fr;
  c += mix(u_c1, u_c2, .5) * .95 * exp(-y * y * 260.) * (.35 + .65 * fr);
  c += u_c1 * 1.75 * box2(vec2(wrapA(ph + 1.05), y - .32), vec2(.42, .2), .035);
  c += u_c2 * 1.2 * box2(vec2(wrapA(ph - 1.3), y - .08), vec2(.07, .5), .05);
  c += u_c1 * .85 * smoothstep(.8, .85, y);
  c += u_c1 * .9 * box2(vec2(wrapA(ph - 2.65), y - .32), vec2(.36, .14), .05);
  // the lit room behind the camera, which the face of a droplet mirrors back as soft grey
  c += vec3(.16, .165, .18) * smoothstep(-.2, .9, r.z) * smoothstep(-.7, .2, y);
  return c;
}
// hero: metaballs as a height field, normals from the analytic field gradient
vec3 hero(vec2 p, vec2 m, float t, float asp, float tall, float sc, float px){
  float calm = smoothstep(0., .09, sc);
  vec2 c0 = vec2(mix(asp * .25, 0., tall) + sc * 1.6 * (1. - tall), mix(-.01, .3, tall) + sc * 2.2);
  float R = mix(.165, .092, tall);
  // silky flow: a slow, shallow domain warp
  vec2 w = vec2(snoise(p * 1.4 + vec2(0., t * .05)), snoise(p * 1.4 + vec2(5.2, -t * .045)));
  vec2 q = p + w * R * .09 * (1. - calm * .7);
  float F = 0.; vec2 G = vec2(0.);
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    float a = t * (.1 + fi * .021) + fi * 1.7;
    float orb = fi < .5 ? 0. : (1.2 + .45 * sin(t * .09 + fi * 2.1)) * R * mix(1., .78, tall) * (1. - calm * .75);
    vec2 c = c0 + (fi < .5 ? vec2(sin(t * .11), cos(t * .08)) * R * .12 : vec2(cos(a), sin(a * 1.3 + fi)) * orb * vec2(1., .82));
    vec2 dm = c - m; float dd = dot(dm, dm);
    c += dm / sqrt(dd + 1e-4) * R * .3 * exp(-dd / (R * R * 1.3)); // the pointer nudges droplets away
    float r = R * (fi < .5 ? 1. : .44 + .1 * sin(fi * 3.1));
    vec2 d = q - c; float d2 = dot(d, d) + 1e-5;
    float k = r * r / d2; F += k; G -= 2. * k / d2 * d;
  }
  float g = F - 1.;
  float K = 1.15, A = R * .95;
  float e = exp(-max(g, 0.) * K), s = sqrt(max(1. - e, 1e-4));
  vec2 dH = A * K * e / (2. * s) * G;
  // the pointer pushes a dent and a ring of ripples into the surface
  vec2 dq = q - m; float r2 = dot(dq, dq), rr = sqrt(r2 + 1e-6), rd = R * .5;
  float D = exp(-r2 / (rd * rd)) * (1. - calm);
  dH += A * .4 * D * 2. * dq / (rd * rd);
  float env2 = exp(-rr / (R * .7)) * (1. - calm);
  dH += A * .022 * 60. * cos(rr * 60. - t * 2.2) * env2 * dq / rr;
  vec3 n = normalize(vec3(-dH, 1.));
  float cov = clamp(g / (length(G) * px * 1.3) + .5, 0., 1.);
  vec3 v = normalize(vec3((p - c0) * .18, -1.));
  vec3 r = reflect(v, n);
  float spin = t * .035 + m.x * .35;
  float f = pow(1. - n.z, 4.);
  vec3 metal = env(r, spin) * mix(vec3(.8, .82, .86), vec3(1.), f);
  metal += (.5 + .5 * cos(6.2832 * (vec3(0., .33, .67) + (1. - n.z) * 1.4 + t * .015))) * u_c3 * pow(1. - n.z, 7.) * .12;
  // the studio behind the pool: a soft sweep of light, a contact shadow at the rim
  vec2 dc = (p - c0) / vec2(1., .8);
  vec3 bg = u_c0 + vec3(.04, .041, .047) * exp(-dot(dc, dc) * 3.2) * (1. - calm * .5);
  bg *= 1. - .5 * exp(min(g, 0.) * 7.) * (1. - cov);
  return mix(bg, metal, cov);
}
// contact: a side-on ferrofluid pool along the bottom; spikes (solids of revolution) rise toward the pointer
vec3 ferro(vec2 p, vec2 m, float t, float asp, float tall, float px){
  float yb = -.5 + mix(.19, .25, tall);
  float prox = smoothstep(.85, .05, m.y - yb) * step(-.5, m.y);
  float gx = exp(-pow((p.x - m.x) / .22, 2.));
  float base = yb + .05 * gx * prox;
  float sp = mix(.05, .046, tall);
  float ci = floor(p.x / sp), xc = (ci + .5) * sp;
  float gxc = exp(-pow((xc - m.x) / .2, 2.));
  float A = .013 + .006 * sin(t * 1.1 + ci * 1.7) + mix(.13, .085, tall) * gxc * prox;
  float hy = p.y - base, hn = clamp(hy / A, 0., 1.);
  float lean = clamp((m.x - xc) * .1, -.01, .01) * hn * prox;
  float dx = p.x - xc - lean, hw = sp * .5, P = 2.4;
  float rho = hw * (1. - pow(hn, 1. / P));
  float sCov = clamp((rho - abs(dx)) / (px * 1.3) + .5, 0., 1.) * step(0., hy) * step(hn, .999);
  float pCov = clamp(-hy / (px * 1.3) + .5, 0., 1.);
  float k = A * P * pow(max(hn, 1e-3), (P - 1.) / P) / hw;
  float u = clamp(dx / max(rho, 1e-4), -.9, .9);
  vec3 nS = normalize(vec3(u * k, 1., sqrt(max(0., 1. - u * u)) * k));
  float ang = clamp(-hy / .12, 0., 1.) * PI * .42;
  vec3 nP = normalize(vec3(.14 * snoise(vec2(p.x * 3.5, p.y * 5. + t * .08)), cos(ang), sin(ang) + .05));
  vec3 n = sCov > pCov ? nS : nP;
  float cov = max(sCov, pCov);
  vec3 v = normalize(vec3(p.x * .12, -.22, -1.));
  vec3 r = reflect(v, n);
  float f = pow(1. - abs(n.z), 3.);
  vec3 metal = env(r, t * .02 + m.x * .3) * mix(vec3(.34, .35, .38), vec3(1.), f);
  vec3 bg = u_c0 + vec3(.05, .052, .06) * exp(-max(p.y - yb, 0.) * 4.5) * (.55 + .45 * gx * prox + .25);
  return mix(bg, metal, cov);
}
void main(){
  float asp = u_res.x / u_res.y;
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float tall = 1. - smoothstep(.75, 1.2, asp);
  float px = 1. / u_res.y;
  vec3 c = u_scroll < .5 ? hero(p, m, u_time, asp, tall, u_scroll, px) : ferro(p, m, u_time, asp, tall, px);
  // dither so the capped resolution reads as fine grain, never as banding
  c += (hash21(gl_FragCoord.xy + fract(u_time * 7.) * 91.) - .5) * (2.2 / 255.);
  gl_FragColor = vec4(c, 1.);
}`,
    },
    load: () => import("@/designs/mercury"),
  },
  {
    id: "thermal", name: "Thermal", mood: "seeing the heat of the work", dark: true,
    keywords: ["thermal","infrared","ir","heat","flir","ironbow","camera","temperature","warm","hot"],
    swatch: ["#05070D","#E8EDF5","#FC780F","#800A85"],
    cardFont: "\"Space Grotesk\", system-ui, sans-serif",
    fonts: "family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400..600",
    shader: {
      colors: ["#04060C","#800A85","#FC780F","#FFD138"], scale: 0.5, host: "#th-ir",
      source: `uniform vec3 u_pv; // palette: x from, y to, z sweep progress 0..1 (0,0,0 = iron at rest)
vec3 ironP(float t){ vec3 c = vec3(0.016,0.024,0.047); c = mix(c, vec3(0.102,0.031,0.322), smoothstep(0.000, 0.200, t)); c = mix(c, vec3(0.502,0.039,0.522), smoothstep(0.200, 0.400, t)); c = mix(c, vec3(0.859,0.161,0.302), smoothstep(0.400, 0.560, t)); c = mix(c, vec3(0.988,0.471,0.059), smoothstep(0.560, 0.720, t)); c = mix(c, vec3(1.000,0.820,0.220), smoothstep(0.720, 0.870, t)); c = mix(c, vec3(1.000,0.980,0.859), smoothstep(0.870, 1.000, t)); return c; }
vec3 rainbowP(float t){ vec3 c = vec3(0.016,0.024,0.047); c = mix(c, vec3(0.051,0.059,0.349), smoothstep(0.000, 0.150, t)); c = mix(c, vec3(0.102,0.349,0.949), smoothstep(0.150, 0.300, t)); c = mix(c, vec3(0.102,0.851,0.902), smoothstep(0.300, 0.440, t)); c = mix(c, vec3(0.349,0.902,0.302), smoothstep(0.440, 0.580, t)); c = mix(c, vec3(1.000,0.902,0.149), smoothstep(0.580, 0.720, t)); c = mix(c, vec3(1.000,0.251,0.102), smoothstep(0.720, 0.870, t)); c = mix(c, vec3(1.000,0.902,0.851), smoothstep(0.870, 1.000, t)); return c; }
vec3 whiteP(float t){ vec3 c = vec3(0.016,0.024,0.047); c = mix(c, vec3(0.969,0.976,1.000), smoothstep(0.000, 1.000, t)); return c; }

vec3 pal(float t, float id){ t = clamp(t, 0., 1.); return id < .5 ? ironP(t) : id < 1.5 ? rainbowP(t) : whiteP(t * t * (3. - 2. * t) * .35 + t * .65); }

void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, wide = step(1.15, asp), t = u_time;
  vec2 p = (fc - .5 * u_res) / u_res.y;

  // ambient heat: two fbm warp the third, so warmth pools and creeps like air over a surface
  vec2 q = vec2(fbm(p * 1.25 + vec2(0., t * .045)), fbm(p * 1.25 + vec2(5.2, 1.3) - vec2(t * .035, 0.)));
  float n = fbm(p * 1.55 + 1.8 * q + vec2(t * .018, -t * .014));

  // warm bodies drifting on slow paths around the portrait side
  vec2 home = wide > .5 ? vec2(asp * .2, .02) : vec2(0., -.16);
  float b = 0.;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = home + vec2(sin(t * (.07 + fi * .013) + fi * 2.1) * mix(.26, .4, wide), cos(t * (.06 + fi * .017) + fi * 1.7) * .25);
    vec2 d = p - c + .14 * q;
    b += exp(-dot(d, d) * (10. + fi * 5.)) * (.5 - fi * .07);
  }

  // the visitor's hand: a tight hot core and a wide diffused halo around the smoothed pointer
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  float act = step(.0015, length(u_mouse - .5));
  vec2 dm = p - m + .05 * q;
  float r2 = dot(dm, dm);
  float hand = (exp(-r2 * 60.) * .5 + exp(-r2 * 8.) * .24) * act;

  // cool the reading column and the hero's lower edge, so copy sits on calm dark and the page takes over
  float cool = wide > .5 ? mix(.38, 1., smoothstep(.36, .64, uv.x)) : mix(.42, 1., smoothstep(.56, .3, uv.y));
  float h = (.12 + .17 * n + .6 * b) * cool + hand * mix(.55, 1., cool);
  h *= smoothstep(0., .3, uv.y) * mix(1., .55, smoothstep(0., .12, u_scroll));

  // calibration sweep: the new palette wipes down behind a thin bright scan line
  float line = 1. - uv.y, edge = u_pv.z * 1.12 - .06;
  float k = 1. - smoothstep(edge - .004, edge + .004, line);
  vec3 col = mix(pal(h, u_pv.x), pal(h, u_pv.y), k);
  float sweeping = step(.001, u_pv.z) * step(u_pv.z, .999);
  col += vec3(.8, .85, 1.) * exp(-pow((line - edge) * u_res.y * .35, 2.)) * sweeping * .55;

  // sensor finish: faint row banding and grain so the capped resolution reads as texture
  col *= 1. - .035 * step(.5, fract(fc.y * .5));
  col += (hash21(fc + fract(t * 7.1) * 97.) - .5) * .032;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
    },
    load: () => import("@/designs/thermal"),
  },
  {
    id: "starlight", name: "Starlight", mood: "night vision, phosphor", dark: true,
    keywords: ["starlight","night","vision","nightvision","nvg","green","phosphor","stars","dark","military","tactical","infrared","ir"],
    swatch: ["#030803","#A8FF7A","#5FD43A","#EAFFDC"],
    cardFont: "\"Saira Condensed\", \"Arial Narrow\", sans-serif",
    fonts: "family=Saira+Condensed:wght@400;500;600;700&family=Saira+Semi+Condensed:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500",
    shader: {
      colors: ["#010401","#1E4D16","#93EE6C","#F0FFE6"], scale: 0.5,
      source: `#define HY(s) min(.2 + 7. * (s), .34 + 7. * (1. - (s)))
// a well-mixed per-pixel hash (the shared one leaves a lattice at screen-size inputs)
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hexd(vec2 p){
  const vec2 s = vec2(1., 1.7320508);
  vec2 a = mod(p, s) - s * .5, b = mod(p - s * .5, s) - s * .5;
  vec2 g = abs(dot(a, a) < dot(b, b) ? a : b);
  return max(dot(g, vec2(.5, .8660254)), g.x);
}
float star(vec2 q, float cell, float prob, float px){
  vec2 c = q * cell, id = floor(c), f = fract(c) - .5;
  if (h12(id + 71.3) < 1. - prob) return 0.;
  vec2 o = vec2(h12(id + 7.13), h12(id + 3.31)) - .5;
  vec2 d = f - o * .6;
  float b = h12(id + 11.7); b = b * b * b * b;
  float r = px * cell, d2 = dot(d, d) / (r * r);
  // a sharp core plus a wide faint halo on the bright ones: halation in the tube
  return exp(-d2 * 1.1) * (.16 + 1.25 * b) + exp(-d2 * .035) * .2 * b * b;
}
float conifers(float x, float k, float seed){
  float c = floor(x * k), f = fract(x * k);
  float h = h12(vec2(c, seed));
  float w = .3 + .45 * h12(vec2(c, seed + 4.));
  float tri = max(0., 1. - abs(f - .5) * 2. / w);
  return step(.12, h) * tri * (.016 + .05 * h);
}
float fbm3(vec2 p){ return .55 * snoise(p) + .28 * snoise(p * 2.03 + 7.1) + .14 * snoise(p * 4.07 + 3.3); }
// the field: a receding plane (horizon at hg), scrolled forward by s
vec2 ground(vec2 uv, float asp, float hg, float s){
  float depth = .1 / max(hg - uv.y, .004);
  return vec2((uv.x - .5) * asp * depth * 2.2, depth * 1.4 + s * 7.);
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  float px = 1. / u_res.y;
  float s = u_scroll, t = u_time;
  float hy = HY(s);
  vec2 p = vec2((uv.x - .5) * asp, uv.y);
  vec2 m = vec2((u_mouse.x - .5) * asp, u_mouse.y);
  vec2 dm = p - m;
  float cone = exp(-dot(dm, dm) / .042);
  float L = 0.;
  float x = p.x;
  float ridge = hy + .02 * snoise(vec2(x * 1.1, 4.2)) + .01 * snoise(vec2(x * 3.4, 9.1));
  float top = ridge + max(conifers(x, 38., 1.), conifers(x + .011, 61., 7.) * .7);
  float skyM = smoothstep(top - px, top + px, uv.y);
  if (uv.y > hy - .02) {
    // sky: airglow toward the horizon, sparse stars, a faint milky way, a hazy far ridge
    vec2 q = vec2(x + t * .0015, uv.y - hy);
    float up = max(0., uv.y - hy);
    float sky = .03 + .2 * exp(-up * 7.) + .05 * exp(-up * 2.);
    float band = exp(-pow((q.y - .55 - q.x * .3) * 3.2, 2.));
    float mw = band > .03 ? fbm(q * 2.4 + 5.) : 0.;
    sky += band * (.02 + .045 * max(mw + .2, 0.));
    sky += star(q, 26., .2, px) + star(q + 3.7, 64., .1 + band * .25, px) * .45;
    float far = hy + .055 + .018 * snoise(vec2(x * .8 + 3., 2.)) + .006 * snoise(vec2(x * 5., 1.));
    sky = mix(sky, .1 + .018 * vnoise(p * 60.), smoothstep(far + px, far - px, uv.y) * .75);
    sky += cone * .015;
    // trees: black against the glow; the IR cone picks out the foliage
    float tree = .006 + cone * (.05 + .08 * vnoise(p * vec2(170., 95.)));
    L = mix(tree, sky, skyM);
  }
  if (uv.y < top + px) {
    // the field: faint 1px contour lines (width from the local gradient, so they stay crisp at any distance);
    // the IR cone lights the near ground and brings the lines up
    float hg = min(hy, 1.3);
    vec2 g0 = ground(uv, asp, hg, s);
    float h = fbm3(g0 * .5);
    float hx = fbm3(ground(uv + vec2(px / asp, 0.), asp, hg, s) * .5);
    float hv = fbm3(ground(uv + vec2(0., px), asp, hg, s) * .5);
    float N = 7., gr = N * length(vec2(hx - h, hv - h)) + 1e-4;
    float dl = abs(fract(h * N + .5) - .5) / gr;
    float line = (1. - smoothstep(.45, 1.3, dl)) * (1. - smoothstep(.12, .4, gr));
    float field = .012 + .006 * (h + .5) + line * (.03 + .2 * cone) + cone * .04;
    L = uv.y > hy - .02 ? mix(field, L, skyM) : field;
  }
  // shot noise and scintillation: frame-to-frame sparkle (a single still frame in performance mode)
  float fr = floor(t * 24.);
  L += (h12(fc + fr * 17.31) - .5) * (.032 + .06 * L);
  L += step(.99965, h12(fc * 1.37 + fr * 41.7)) * .45;
  // the tube: brighter centre, honeycomb fibre bundle at the rim, circular vignette
  vec2 vc = (uv - .5) * vec2(asp, 1.);
  float rr = length(vc) / (.5 * sqrt(asp * asp + 1.));
  L *= mix(.7, 1.06, 1. - smoothstep(0., .95, rr));
  float hc = smoothstep(.32, .5, hexd(fc / (u_res.y / 140.)));
  L += hc * .03 * smoothstep(.45, .8, rr) * (1. - smoothstep(.8, 1., rr));
  L *= 1. - hc * .6 * smoothstep(.5, .92, rr);
  L *= 1. - smoothstep(.66, 1.03, rr);
  L = max(L, 0.);
  vec3 c = mix(u_c0, u_c1, smoothstep(0., .3, L));
  c = mix(c, u_c2, smoothstep(.26, .85, L));
  c = mix(c, u_c3, smoothstep(.85, 1.4, L));
  gl_FragColor = vec4(c, 1.);
}`,
    },
    load: () => import("@/designs/starlight"),
  },
  {
    id: "tracker", name: "Tracker", mood: "a vision model watching", dark: false,
    keywords: ["tracker","tracking","vision","computer vision","cv","boxes","bounding","detect","detection","depth","lab","yolo","camera"],
    swatch: ["#F2F2EE","#0C0D0F","#E0103F","#7E03A8"],
    cardFont: "\"Inter Tight\", \"Geist\", sans-serif",
    fonts: "family=Inter+Tight:wght@300..700&family=JetBrains+Mono:wght@400..700",
    shader: {
      colors: ["#0B0A3E","#6E0BA8","#E0457B","#FBA93A"], scale: 0.5, host: "#tk-gl",
      source: `#define SUBJ vec2(.5, .55)
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
vec3 pal(float x){
  x = clamp(x, 0., 1.);
  vec3 c = mix(u_c0, u_c1, smoothstep(.06, .32, x));
  c = mix(c, u_c2, smoothstep(.32, .56, x));
  c = mix(c, u_c3, smoothstep(.56, .78, x));
  return mix(c, vec3(.97, .96, .66), smoothstep(.78, .98, x));
}
float field(vec2 uv, float asp, float t){
  vec2 p = (uv - .5) * vec2(asp, 1.);
  // the floor plane: near at the bottom of the frame, far at the top
  float d = .08 + .26 * (1. - uv.y);
  // the subject: a head and shoulders, nearest thing in the room
  vec2 s = p - (SUBJ - .5) * vec2(asp, 1.);
  float head = exp(-dot(s, s) * 7.5);
  vec2 sb = s + vec2(0., .5);
  float body = exp(-(sb.x * sb.x * 3.2 + sb.y * sb.y * 5.));
  d += .58 * max(head, body * .82);
  // three slow objects drifting through the scene
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * (.07 + fi * .03) + fi * 2.1) * .62 * asp, cos(t * (.05 + fi * .02) + fi * 1.7) * .36);
    vec2 q = p - c;
    d += .26 * exp(-dot(q, q) * (9. + fi * 5.));
  }
  // the visitor's pointer is a hand held up to the camera
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  vec2 mq = p - m;
  d += .36 * exp(-dot(mq, mq) * 26.);
  d += .1 * fbm(p * 2.3 + vec2(t * .025, -t * .018));
  return d;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y, t = u_time;
  float e = 1.5;
  float d = field(uv, asp, t);
  float dx = field(uv + vec2(e / u_res.x, 0.), asp, t) - d;
  float dy = field(uv + vec2(0., e / u_res.y), asp, t) - d;
  float g = length(vec2(dx, dy)) / e;
  float N = 12.;
  float dd = clamp(d, 0., 1.);
  // segmentation: depth posterised into bands, band edges ordered-dithered so low resolution reads as texture
  float b = bayer4(gl_FragCoord.xy);
  float band = (floor(dd * N + (b - .5) * .42) + .5) / N;
  vec3 col = pal(band);
  // contour lines at every band edge, a constant pixel width whatever the slope
  float f = fract(dd * N);
  float dist = min(f, 1. - f) / max(g * N, 1e-4);
  col = mix(col, vec3(1.), (1. - smoothstep(.5, 1.25, dist)) * .5);
  // a lidar sweep climbs the frame; just behind it the scene shows as a point grid
  float sw = fract(t * .07) * 1.3 - .15;
  float sy = uv.y - sw;
  float lineS = exp(-sy * sy * 3000.);
  vec2 cell = mod(gl_FragCoord.xy, 4.);
  float pts = step(cell.x, .9) * step(cell.y, .9) * smoothstep(-.12, 0., sy) * step(sy, 0.);
  col = mix(col, vec3(1.), lineS * .55 + pts * .38);
  // lens vignette, then grain
  col *= .8 + .2 * smoothstep(1.15, .25, length((uv - .5) * vec2(asp * .85, 1.)));
  col += (hash21(gl_FragCoord.xy + fract(t * 7.) * 41.) - .5) * .045;
  gl_FragColor = vec4(col, 1.);
}`,
    },
    load: () => import("@/designs/tracker"),
  },
  {
    id: "foil", name: "Foil", mood: "holo card, tilted light", dark: true,
    keywords: ["foil","holo","holographic","iridescent","iridescence","card","trading","pearl","y2k","chrome","shiny","rainbow"],
    swatch: ["#0A0A10","#EEEAF6","#B9A8FF","#8BF0D3"],
    cardFont: "\"Unbounded\", \"Geist\", sans-serif",
    fonts: "family=Unbounded:wght@300..700",
    shader: {
      colors: ["#2A2838","#E9E4F5","#B9A8FF","#0A0A10"], scale: 0.75, host: "#fo-gl",
      source: `void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float asp = u_res.x / u_res.y;
  vec2 p = vec2((uv.x - .5) * asp, uv.y - .5);
  float t = u_time;
  // the light: the pointer is the lamp, with a slow drift so the foil breathes when nobody touches it
  vec2 m = clamp(u_mouse - .5, -1.1, 1.1) + .05 * vec2(sin(t * .37), cos(t * .29));
  vec3 L = normalize(vec3(m * 1.9, 1.));
  vec3 Hv = normalize(L + vec3(0., 0., 1.));
  // height map: broad, soft crinkles in the foil; three fbm taps give the surface normal
  vec2 q = p * 1.05 + vec2(t * .01, -t * .007);
  float e = .05;
  float h0 = fbm(q), hx = fbm(q + vec2(e, 0.)), hy = fbm(q + vec2(0., e));
  vec3 N = normalize(vec3((h0 - hx) / e * .11, (h0 - hy) / e * .11, 1.));
  float ndl = max(dot(N, L), 0.), ndh = max(dot(N, Hv), 0.);
  // thin film: phase from film thickness (height map), a diagonal grating, and the light angle (the tilt)
  float grat = dot(p, vec2(.8, .6));
  float ph = .32 * h0 + .5 * grat + .75 * dot(m, vec2(.9, .55)) + .3 * (1. - ndh);
  // a pastel interference ramp (mint, sky, lilac, rose, champagne) rather than a loud rainbow
  vec3 film = .76 + .24 * cos(6.2831853 * (ph + vec3(.0, .33, .67)));
  vec3 silver = mix(u_c0, u_c1, .35 + .5 * ndl);
  vec3 col = mix(silver, film * (.74 + .34 * ndl), .8);
  // a broad sheen band that slides with the light, plus a tight specular
  vec2 sd = p - m * vec2(asp, 1.) * .7;
  float band = exp(-pow(dot(sd, normalize(vec2(1., .72))) * 3., 2.));
  col += band * .16 + pow(ndh, 140.) * .4;
  // embossed foil tooth (value noise at the pixel scale, not fbm)
  col *= .965 + .06 * vnoise(gl_FragCoord.xy * .5);
  // glitter: sparse cells glint as the light passes over them
  vec2 cell = floor(gl_FragCoord.xy / 2.);
  float r = hash21(cell);
  float tw = step(.986, r) * pow(max(0., sin(r * 97. + dot(m, vec2(15., 10.)) + t * .7)), 14.);
  col += tw * mix(vec3(1.), u_c2, .35) * 1.15;
  // settle toward deep ink at the rim so the frame reads as a printed card
  float vig = smoothstep(.95, .2, length(p / vec2(asp, 1.) * vec2(1.25, 1.)));
  col = mix(u_c3, col, .82 + .18 * vig);
  // grain/dither so the capped resolution reads as foil tooth, not blur
  col += (hash21(gl_FragCoord.xy + fract(t * 3.1) * 91.) - .5) * .03;
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`,
    },
    load: () => import("@/designs/foil"),
  },
];

/** Palettes all render through this one layout, coloured by the palette's tokens. */
export const CLASSIC_ID = "classic";
export const loadClassic = () => import("@/designs/classic");

/** Cookie (SSR) + localStorage (client) key holding the chosen design id or palette slug. */
export const DESIGN_KEY = "rithvik-design";

const BY_ID = new Map(DESIGNS.map((d) => [d.id, d]));

/** The registered design for an id, if it is one of the nine (palette slugs return undefined). */
export function designById(id: string): DesignMeta | undefined {
  return BY_ID.get(id);
}

/** Validates a stored/requested look against the nine designs and the live palette slugs. */
export function resolveLook(raw: string | null | undefined, paletteSlugs: string[]): string | null {
  if (!raw) return null;
  return BY_ID.has(raw) || paletteSlugs.includes(raw) ? raw : null;
}

/** The `<html>` attributes for a look: designs set both to their id, palettes render Classic. */
export function htmlAttrsFor(look: string): { design: string; theme: string } {
  return { design: BY_ID.has(look) ? look : CLASSIC_ID, theme: look };
}

/** Google Fonts stylesheet URL for a design, if it declares fonts. */
export function fontsHref(meta: DesignMeta | undefined): string | null {
  return meta?.fonts ? `https://fonts.googleapis.com/css2?${meta.fonts}&display=swap` : null;
}

/**
 * Pre-paint boot (static string, runs before first paint). SSR already rendered the cookie's look;
 * this only corrects <html> when the cookie is missing (legacy `rithvik-theme` visitors land on
 * Classic + their palette) or a `?theme=` deep link asks for another look, then writes the cookie so
 * the next SSR is right. Palettes are validated against the injected token sheet, so a deleted
 * palette slug can't strip the page's colours. Also restores performance mode (`html.lite`).
 * Literal keys mirror THEME_STORAGE_KEY (lib/themes) and LITE_KEY (SiteProvider); imported here they
 * would break the node:test run, which can't resolve the `@/` alias.
 */
export const BOOT_SCRIPT = `(function(){try{var h=document.documentElement,D=${JSON.stringify(DESIGNS.map((d) => d.id))},`
  + `ck=(document.cookie.match(/(?:^|; )${DESIGN_KEY}=([^;]*)/)||[])[1],`
  + `q=new URLSearchParams(location.search).get("theme"),`
  + `t=q||(ck?null:(localStorage.getItem("${DESIGN_KEY}")||localStorage.getItem("rithvik-theme"))),`
  + `s=document.getElementById("theme-tokens"),`
  + `ok=t&&(D.indexOf(t)>-1||(/^[a-z0-9-]+$/.test(t)&&s&&s.textContent.indexOf('[data-theme="'+t+'"]')>-1));`
  + `if(ok){h.dataset.design=D.indexOf(t)>-1?t:"${CLASSIC_ID}";h.dataset.theme=t;`
  + `if(!ck)document.cookie="${DESIGN_KEY}="+t+"; path=/; max-age=31536000; samesite=lax";}`
  + `if(localStorage.getItem("rithvik-lite")==="1")h.classList.add("lite");}catch(e){}})();`;

/** True when a palette background is dark (sets `color-scheme`); non-hex values count as light. */
export function isDarkColor(c: string | undefined): boolean {
  const m = c?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return false;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
