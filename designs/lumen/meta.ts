import type { DesignMeta } from "../../lib/designs/types";

// Lumen: near-black, white type and soft vivid light, after OpenAI's visual language (colour, type feel, motion).
// No logos or marks. The shader is a multi-point mesh gradient (mmeshy-style): seven coloured control points drift on
// slow Lissajous paths and blend through normalised Gaussian weights over a gently flowing domain, then light falls off
// to black. The pointer parts the control points and carries a soft white light (`u_hover`); a press sends one
// ripple through the field (`u_tap`: xy in uv, z = its age in seconds, w = strength).
export const META: DesignMeta = {
  id: "lumen", name: "Lumen", mood: "soft light on black, precise", dark: true,
  keywords: ["lumen", "openai", "chatgpt", "gpt", "gradient", "mesh", "light", "glow", "minimal", "black", "luminous", "aurora", "precise"],
  swatch: ["#000000", "#FFFFFF", "#4F6BFF", "#FF7A45"],
  cardFont: "\"Inter Tight\", system-ui, sans-serif",
  fonts: "family=Inter+Tight:ital,wght@0,300..700;1,300..700",
  shader: {
    colors: ["#2F5BFF", "#9A5CFF", "#FF6A3D", "#33D1FF"], scale: 0.4, host: "#lm-light",
    source: `uniform float u_hover; uniform vec4 u_tap;
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time;
  float tall = 1. - smoothstep(.75, 1.2, asp);
  vec2 p = (uv - .5) * vec2(asp, 1.), m = (u_mouse - .5) * vec2(asp, 1.);
  // where the light lives: right of the copy on a wide screen, low behind the portrait on a phone
  vec2 L = mix(vec2(asp * .2, .02), vec2(0., -.2), tall);
  float spread = mix(1., .62, tall);
  // a slow flow through the domain, so the blend lines never sit still
  vec2 q = p + .08 * vec2(snoise(p * 1.1 + vec2(0., t * .05)), snoise(p * 1.1 + vec2(4.1, -t * .045)));
  // one press, one ripple
  vec2 tp = (u_tap.xy - .5) * vec2(asp, 1.); float age = u_tap.z;
  vec2 dt = q - tp; float rr = length(dt) + 1e-4;
  float ring = exp(-pow((rr - age * .5) * 8., 2.)) * exp(-age * 1.3) * u_tap.w;
  q += dt / rr * ring * .06;
  vec3 col = vec3(0.); float W = 0.;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 o = L + vec2(cos(t * (.07 + fi * .011) + fi * 2.4) * .5, sin(t * (.06 + fi * .009) + fi * 1.7) * .34) * spread;
    vec2 dm = o - m; o += dm * .45 * exp(-dot(dm, dm) * 7.) * u_hover; // the pointer parts the light
    vec2 d = q - o; float w = exp(-dot(d, d) * 13. / (spread * spread)) + 1e-5; // narrow kernels keep each colour its own region
    vec3 c = i == 0 ? u_c0 : i == 1 ? u_c1 : i == 2 ? u_c2 : i == 3 ? u_c3 : i == 4 ? vec3(1., .44, .72) : i == 5 ? vec3(1., .8, .45) : vec3(.1, .12, .55);
    col += c * w; W += w;
  }
  col /= W;
  // the light falls off to black; a soft white core where the colours crowd, and where the pointer is
  vec2 e = (p - L) / (vec2(.78, .62) * spread);
  float E = exp(-dot(e, e) * 1.1);
  float hand = exp(-dot(p - m, p - m) * 16.) * u_hover;
  col = mix(vec3(dot(col, vec3(.299, .587, .114))), col, 1.3); // the blend greys colours; push them back to vivid
  col = max(col, 0.) * (E * 1.5 + hand * .45) + vec3(.9, .93, 1.) * (pow(E, 8.) * .08 + hand * .12 + ring * .25);
  col = 1. - exp(-col * 1.2); // soft shoulder: light, never clipped
  // fine grain, so the low-res canvas reads as a photograph of light rather than as banding
  col += (hash21(fc + fract(t * 7.) * 91.) - .5) * (3. / 255.);
  gl_FragColor = vec4(col, 1.);
}`,
  },
  load: () => import("@/designs/lumen"),
};
