/** Nimbus fragment shader body, copied from docs/mockups/v7/themes/nimbus.js (day sky, sun at .5,.8). */
export const NIMBUS_SOURCE = `
#define SUN vec2(.5, .8)
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
}`;
