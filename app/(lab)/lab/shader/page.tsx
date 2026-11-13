"use client";
import { useEffect, useMemo, useState } from "react";
import SiteProvider from "@/components/site/SiteProvider";
import ShaderCanvas, { useShaderUniforms } from "@/components/site/ShaderCanvas";
import LiteToggle from "@/components/site/LiteToggle";
import { fixture } from "@/lib/content/fixture";
import { getScale, isAnimating } from "@/lib/shader/runtime";
import type { ShaderSpec } from "@/lib/designs/types";
import { NIMBUS_SOURCE } from "./nimbus-source";

// Nimbus's spec (day sky) plus a test uniform that tints the clouds, set from a button below.
const SPEC: ShaderSpec = {
  source: NIMBUS_SOURCE
    .replace("void main(){", "uniform float u_flash;\nvoid main(){")
    .replace("gl_FragColor = vec4(c, 1.);", "c = mix(c, vec3(1., .1, .4), u_flash * .6);\n  gl_FragColor = vec4(c, 1.);"),
  colors: ["#FFFFFF", "#C4E6FF", "#6CC4FF", "#0A9BFF"],
  scale: 0.35,
};

/** Buttons that drive the runtime: a uniform toggle and a spec swap (program swap clears uniforms). */
function Controls({ onSwap }: { onSwap: () => void }) {
  const setUniform = useShaderUniforms();
  const [on, setOn] = useState(false);
  const btn = { font: "14px system-ui", padding: "8px 12px", borderRadius: 8, border: "1px solid #0003", background: "#fffc", cursor: "pointer" };
  return (
    <div style={{ position: "fixed", top: 16, left: 16, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
      <button style={btn} onClick={() => { setUniform("u_flash", on ? 0 : 1); setOn(!on); }}>setUniform u_flash = {on ? 0 : 1}</button>
      <button style={btn} onClick={onSwap}>Swap program</button>
      <span style={{ ...btn, padding: 0, display: "grid", placeItems: "center", width: 36, height: 36 }}><LiteToggle /></span>
    </div>
  );
}

/** Lab harness for the shader runtime: Nimbus full-screen, performance toggle, uniform + swap tests. */
export default function Page() {
  const [n, setN] = useState(0);
  const spec = useMemo(() => ({ ...SPEC }), [n]); // eslint-disable-line react-hooks/exhaustive-deps -- a new object = a new program
  useEffect(() => { (window as unknown as { __lab: object }).__lab = { getScale, isAnimating }; }, []);
  return (
    <SiteProvider content={fixture}>
      <ShaderCanvas spec={spec} dark={false} />
      <Controls onSwap={() => setN((x) => x + 1)} />
      <h1 style={{ position: "relative", zIndex: 1, font: "600 48px system-ui", textAlign: "center", margin: 0, paddingTop: "40vh" }}>Shader lab</h1>
    </SiteProvider>
  );
}
