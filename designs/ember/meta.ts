import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Ember: the fire element. A forge at night: living flame licking up the portrait side, heat haze over it, embers
// rising; the pointer is a burning palm, its speed stokes the fire, a press throws a ring of flame.
export const META: DesignMeta = {
  id: "ember", name: "Ember", mood: "the forge, alight", dark: true,
  keywords: ["ember","fire","flame","flames","forge","blaze","burn","heat","lava","inferno","elemental","ninja","red","orange"],
  swatch: ["#0E0807","#F6E7DA","#FF6A1A","#FFC447"],
  cardFont: "\"Big Shoulders Display\", Impact, sans-serif",
  fonts: "family=Big+Shoulders+Display:wght@600..900&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600",
  shader: {
    colors: ["#0B0605","#7A1206","#F2520E","#FFC247"], scale: 0.5, host: "#em-gl",
    source: EL_GLSL + `
// black-body ramp: soot, deep red, orange, yellow, white-hot
vec3 fire(float x){
  x = clamp(x, 0., 1.);
  vec3 c = mix(u_c0, u_c1, smoothstep(.02, .32, x));
  c = mix(c, u_c2, smoothstep(.28, .58, x));
  c = mix(c, u_c3, smoothstep(.55, .82, x));
  return mix(c, vec3(1., .96, .86), smoothstep(.84, 1., x));
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float hearth = smoothstep(.82, .97, u_scroll); // Contact: the fire spreads into a low hearth across the width
  float ch = u_charge;

  // heat haze: the air above the flames shivers, bending everything behind it
  vec2 hz = vec2(snoise(p * vec2(3., 1.4) - vec2(0., t * 1.6)), snoise(p * vec2(2.4, 1.2) + vec2(5., -t * 1.2))) * .018;
  vec2 q = p + hz * (.4 + uv.y);

  // the flame field: noise rushing upward, stretched tall, warped by a slower turbulence so tongues split and curl
  vec2 w = vec2(fbm(q * 1.4 + vec2(0., -t * .35)), fbm(q * 1.4 + vec2(3.1, -t * .3)));
  float n = fbm(vec2(q.x * 2.3, q.y * 1.15 - t * 1.05) + w * 1.1);
  float n2 = fbm(vec2(q.x * 5., q.y * 2.6 - t * 2.1) + w * 1.6);
  // where the fire stands: the portrait side on wide screens, the foot of the hero on phones, a hearth at Contact
  float side = wide > .5 ? smoothstep(.34, .78, uv.x) : .55;
  float base = mix(mix(.22, .92, side) * (1. - .15 * smoothstep(.85, 1., uv.x)), .62, hearth);
  float height = mix(base, .5, hearth) + .22 * ch;
  float f = (n * .55 + n2 * .22) + height * 1.25 - uv.y * (1.9 - .5 * ch) - .2;

  // the burning palm: a tight hot core at the pointer and a tongue of flame pulled up off it
  vec2 dm = q - m; float r2 = dot(dm, dm);
  float palm = (exp(-r2 * 70.) * .55 + exp(-(dm.x * dm.x * 26. + max(dm.y, 0.) * max(dm.y, 0.) * 5. + min(dm.y, 0.) * min(dm.y, 0.) * 60.)) * (.35 + .25 * n2)) * act * (.65 + .6 * ch);
  f += palm;

  // a strike: a ring of fire bursting outward, a white flash at its heart
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  float ring = elRing(q + hz * 2., bc, u_burst.z, .9, .045 + .03 * u_burst.z);
  f += ring * (.9 + .4 * n2) + exp(-dot(q - bc, q - bc) * 90.) * exp(-u_burst.z * 7.) * step(u_burst.z, 3.);

  vec3 col = fire(f);
  // soot and the dark forge behind the fire: a faint warm floor glow so the black reads as depth, not void
  col += u_c1 * .22 * smoothstep(.55, 0., uv.y) * (.6 + .4 * n);
  col = max(col, u_c0 * (1. + .6 * smoothstep(.6, 0., uv.y)));

  // embers: two layers rising at different speeds, swaying, brighter while the fire is stoked
  float e1 = elMotes(p + vec2(.04 * sin(t * .7 + p.y * 3.), 0.), t, 15., vec2(.08, -.9), .11, .12 + .12 * ch);
  float e2 = elMotes(p + vec2(.03 * sin(t * .9 + p.y * 5. + 2.), 0.), t, 30., vec2(-.05, -1.7), .14, .1 + .1 * ch);
  float elift = smoothstep(1.05, .2, uv.y) * mix(.45 + .55 * side, 1., hearth);
  col += (vec3(1., .62, .2) * e1 + vec3(1., .82, .45) * e2 * .8) * elift;

  // forge finish: vignette and grain
  col *= 1. - .45 * pow(length((uv - vec2(.5, .45)) * vec2(1.1, 1.)), 2.2);
  col += elGrain(fc, t) * .03;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/ember"),
};
