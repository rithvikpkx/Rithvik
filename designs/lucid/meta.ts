import type { DesignMeta } from "../../lib/designs/types";

// The world behind the glass: a deep night with soft colour forms and a faint caustic web drifting through it
// (fixed to the viewport, so every glass panel on the page has something to bend). Over the hero float a few thick
// liquid-glass drops (signed-distance metaballs) that refract the forms with real dispersion, catch a specular
// light from the pointer, and merge with the drop the pointer carries. `u_sy` (scroll in viewport heights, from
// motion.ts) lets the drops ride up with the hero and calms the field while you read.
const SHADER = `uniform float u_sy;
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }

// a cheap caustic web: a few rounds of a sine warp, sharpened
float caustic(vec2 uv, float t){
  vec2 p = uv * 6.2832 - 250., i = p; float c = 1.;
  for (int n = 0; n < 4; n++) {
    float f = t * (1. - 3.5 / float(n + 1));
    i = p + vec2(cos(f - i.x) + sin(f + i.y), sin(f - i.y) + cos(f + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + f) / .005), p.y / (cos(i.y + f) / .005)));
  }
  c = 1.17 - pow(c / 4., 1.4);
  return pow(abs(c), 8.);
}

vec3 world(vec2 p, float t, float asp, float dim){
  vec2 q = p + vec2(0., u_sy * .22) + .1 * vec2(sin(p.y * 2.3 + t * .11), cos(p.x * 1.9 - t * .09));
  vec3 c = u_c0 * (.9 + .5 * smoothstep(-.7, .7, p.y));
  vec2 a = vec2(asp * .32 + .1 * sin(t * .05), .18 + .12 * cos(t * .07));
  vec2 b = vec2(-asp * .12 + .14 * cos(t * .04), -.3 + .1 * sin(t * .06));
  vec2 d = vec2(asp * .08 + .2 * sin(t * .03 + 2.), .26 + .08 * cos(t * .05));
  vec2 e = vec2(asp * .46, -.36 + .1 * sin(t * .045));
  c += u_c1 * exp(-dot(q - a, q - a) * 5.) * .55;
  c += u_c2 * exp(-dot(q - b, q - b) * 4.) * .5;
  c += u_c3 * exp(-dot(q - d, q - d) * 4.5) * .5;
  c += vec3(1., .78, .34) * exp(-dot(q - e, q - e) * 7.) * .38;
  // the caustic web takes the colour of the light it crosses, so the glass has lines to bend
  c += (c * 1.6 + .08) * caustic(q * .9 + 3., t * .18) * .55;
  c *= 1. - .4 * smoothstep(.28, .5, p.y); // a darker sky under the header bar
  return c * dim;
}

// the drops: five resting around the portrait side plus the one the pointer carries, merged like liquid
float drops(vec2 p, float t, float asp, float wide, float act, vec2 m){
  float lift = u_sy * .94;
  vec2 o = vec2(0., lift);
  float d = 1e3;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c; float r;
    if (i == 0) { c = wide > .5 ? vec2(asp * .5 - .2, .3) : vec2(asp * .42, .36); r = mix(.07, .1, wide); }
    else if (i == 1) { c = wide > .5 ? vec2(.1, -.33) : vec2(-asp * .36, -.12); r = mix(.05, .07, wide); }
    else if (i == 2) { c = wide > .5 ? vec2(asp * .5 - .08, -.25) : vec2(asp * .3, -.4); r = mix(.09, .15, wide); }
    else if (i == 3) { c = wide > .5 ? vec2(-.05, .36) : vec2(-asp * .1, .44); r = mix(.03, .045, wide); }
    else { c = wide > .5 ? vec2(asp * .5 - .32, -.4) : vec2(-asp * .42, -.44); r = mix(.035, .05, wide); }
    c += o + .035 * vec2(sin(t * (.21 + fi * .03) + fi * 2.4), cos(t * (.17 + fi * .04) + fi * 1.3));
    r *= 1. + .05 * sin(t * .4 + fi * 1.7);
    d = smin(d, length(p - c) - r, .07);
  }
  return smin(d, length(p - m) - .07 * act + (1. - act) * .2, .12);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  float asp = u_res.x / u_res.y, wide = step(1.05, asp), t = u_time;
  vec2 p = (fc - .5 * u_res) / u_res.y;
  // reading sections sit on a calmer field; Contact (the page's end) brightens again
  float dim = mix(1., .6, smoothstep(.45, 1.1, u_sy)) + .42 * smoothstep(.8, .97, u_scroll);
  float act = step(.0015, length(u_mouse - .5)) * (1. - smoothstep(.35, .8, u_sy));
  vec2 m = (u_mouse - .5) * vec2(asp, 1.);
  // the light: the pointer, or a soft key light high on the left when there is none
  vec2 lp = mix(vec2(-asp * .35, .55), m + vec2(-.3, .35), act);

  float d = drops(p, t, asp, wide, act, m);
  vec3 col = world(p, t, asp, dim);
  // the drops' shadow, cast down and away from the light
  vec2 sd = normalize(p - lp + vec2(0., .4)) * .03;
  col *= 1. - .34 * smoothstep(.06, -.01, drops(p - sd, t, asp, wide, act, m)) * step(.0, d);
  if (d < .006) {
    vec2 e = vec2(.0025, 0.);
    vec2 g = vec2(drops(p + e.xy, t, asp, wide, act, m) - drops(p - e.xy, t, asp, wide, act, m),
                  drops(p + e.yx, t, asp, wide, act, m) - drops(p - e.yx, t, asp, wide, act, m)) / (2. * e.x);
    g /= max(length(g), 1e-4);
    float x = clamp(-d / .055, 0., 1.);            // 0 at the rim, 1 past the bezel
    float h = sqrt(1. - (1. - x) * (1. - x));      // a convex circular profile
    float sl = (1. - x) / max(h, .08);             // its slope: steep at the rim, flat on top
    vec2 off = -g * min(sl, 4.) * .03 + g * d * .5; // bent hard at the rim, magnified on top
    vec3 n = normalize(vec3(g * min(sl, 4.) * .55, 1.));
    vec3 gl;
    gl.r = world(p + off * .86, t, asp, dim).r;
    gl.g = world(p + off, t, asp, dim).g;
    gl.b = world(p + off * 1.18, t, asp, dim).b;
    gl = gl * 1.08 + .025;                          // glass gathers a little light
    vec3 L = normalize(vec3(lp - p, .45));
    float spec = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 70.);
    float fres = pow(1. - n.z, 1.6);
    vec2 ld = normalize(lp - p);
    gl += vec3(1.) * spec * 1.1 + vec3(.82, .9, 1.) * fres * .38 * (.6 + .4 * max(dot(g, ld), 0.));
    gl *= 1. - .3 * (1. - x) * max(-dot(g, ld), 0.); // the far rim sits in shadow
    float aa = smoothstep(.006, -.003, d);
    col = mix(col, gl, aa);
  }
  col += (hash21(fc + fract(t) * 91.) - .5) * .018;  // fine grain so the capped resolution reads as texture
  gl_FragColor = vec4(max(col, 0.), 1.);
}`;

export const META: DesignMeta = {
  id: "lucid", name: "Lucid", mood: "liquid glass over moving light", dark: true,
  keywords: ["lucid", "glass", "liquid glass", "liquid", "refraction", "lens", "droplet", "clear", "translucent", "frosted", "crystal", "bubble"],
  swatch: ["#0A0B1E", "#F2F5FF", "#8FE6FF", "#FF7A59"],
  cardFont: "\"Plus Jakarta Sans\", system-ui, sans-serif",
  fonts: "family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Geist+Mono:wght@400..600",
  shader: { colors: ["#0B0C22", "#FF6B4A", "#2EC8FF", "#9A5BFF"], scale: 0.45, source: SHADER },
  load: () => import("@/designs/lucid"),
};
