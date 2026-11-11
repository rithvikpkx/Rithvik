// The elemental family's shared GLSL (Ember, Tide, Stone, Volt, Grove). Each look's meta.ts prepends this to its own
// body, after the runtime's head (lib/shader/head.ts: hash21 / vnoise / snoise / fbm). It carries the family's two
// kinetic uniforms, driven by designs/elemental/motion.ts, and the building blocks every element is made from.
// Plain strings only: meta.ts imports it, and the registry must never pull component code.
export const EL_GLSL = `
uniform vec3 u_burst;  // a strike: xy = where (0..1 canvas space, y up), z = age in seconds (99 = none)
uniform float u_charge; // 0..1: how hard the pointer has been moving lately (the power building up)

// a shockwave travelling out from c: 1 on its front, thinning and fading as it ages
float elRing(vec2 p, vec2 c, float age, float speed, float w){
  float r = length(p - c), front = age * speed;
  return exp(-pow((r - front) / w, 2.)) * exp(-age * 2.4) * step(0., age) * step(age, 3.);
}

// voronoi: x = distance to the nearest seed, y = distance to the nearest edge (cracks, cells, caustics), z = cell id
vec3 elVoro(vec2 p, float t){
  vec2 n = floor(p), f = fract(p), mr = vec2(0.), mg = vec2(0.);
  float md = 8., id = 0.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash21(n + g), hash21(n + g + 17.3));
    o = .5 + .45 * sin(t + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; id = hash21(n + g + 3.1); }
  }
  float me = 8.;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = vec2(hash21(n + g), hash21(n + g + 17.3));
    o = .5 + .45 * sin(t + 6.2831 * o);
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > .00001) me = min(me, dot(.5 * (mr + r), normalize(r - mr)));
  }
  return vec3(sqrt(md), me, id);
}

// drifting motes, one per lucky cell: embers, bubbles, dust, spores. dir = drift in cells per second
float elMotes(vec2 p, float t, float sc, vec2 dir, float sz, float dens){
  vec2 q = p * sc + dir * t;
  vec2 c = floor(q), f = fract(q) - .5;
  float h = hash21(c);
  if (h > dens) return 0.;
  vec2 o = (vec2(hash21(c + 7.1), hash21(c + 3.7)) - .5) * .56 + .14 * vec2(sin(t * (1. + h * 2.) + h * 40.), cos(t * 1.3 + h * 20.));
  float tw = .55 + .45 * sin(t * (2. + 3. * h) + h * 60.);
  return smoothstep(sz, 0., length(f - o)) * tw;
}

// straight-segment noise (-.5 to .5): linear between random knots, so a bolt is a polyline of sharp kinks, not a wave
float elZig(float x, float s){ float i = floor(x); return mix(hash21(vec2(i, s)), hash21(vec2(i + 1., s)), fract(x)) - .5; }

// a jagged bolt from a to b, pinned at both ends; returns the distance to it. flick steps the shape (a new strike)
float elBolt(vec2 p, vec2 a, vec2 b, float flick, float seed, float amp){
  vec2 ba = b - a; float L = length(ba);
  vec2 d = ba / max(L, 1e-4), nrm = vec2(-d.y, d.x);
  vec2 pa = p - a;
  float h = clamp(dot(pa, d) / max(L, 1e-4), 0., 1.);
  float s = seed + flick * 7.13;
  float off = elZig(h * 7., s) + .55 * elZig(h * 19., s + 3.) + .3 * elZig(h * 47., s + 9.);
  off *= amp * L * sin(3.14159 * h);
  float along = dot(pa, d), perp = dot(pa, nrm) - off;
  float outside = max(-along, along - L);
  return length(vec2(max(outside, 0.), perp));
}

// sensor-free film grain, so the capped resolution reads as texture rather than blur
float elGrain(vec2 fc, float t){ return hash21(fc + fract(t * 7.3) * 91.) - .5; }
`;
