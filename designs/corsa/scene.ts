// Corsa's garage: the SP3 on a turntable, rendered with three.js. This module is the documented exception to the
// one-WebGL-context rule (docs/design-systems.md): it is dynamically imported only while Corsa is active and not
// calm, owns exactly one renderer, and `dispose()` frees every geometry, material, texture and render target and
// forces the context lost. The shared shader runtime is not mounted on this look (its meta has no shader).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { AUTO_SPIN, coast, fitDistance, gearFor, lapTimer, rpmFor, viewOffset, type Lap } from "./telemetry";

export const MODEL_URL = "/v7/corsa/sp3.glb";
const MODEL_BYTES = 7_860_000; // fallback for progress when the response has no Content-Length
const CAR_LEN = 4.69; // metres: the SP3 is 4,686 mm long
const FOV = 24;
const START_YAW = 0.85; // a three-quarter front view to open on

export type Telemetry = { rpm: number; gear: number; spin: number; lap: Lap };
export type Garage = { dispose: () => void };
type Opts = {
  /** The element the canvas fills; its --co-cx / --co-cy / --co-f say where the car sits and how wide it is. */
  host: HTMLElement;
  /** Pointer drags anywhere on this element (outside links, buttons and the copy) orbit the car. */
  input: HTMLElement;
  onProgress: (p: number) => void;
  /** Called once the first frame is on screen. */
  onReady: () => void;
  /** Called every rendered frame with the instruments' readings. */
  onFrame: (t: Telemetry) => void;
};

/** Paint and trim, set by material name (the optimiser keeps names; badges were stripped from the asset itself). */
function dress(mat: THREE.Material): THREE.Material {
  const m = mat as THREE.MeshStandardMaterial;
  if (m.name === "paint") {
    // Rosso Corsa: a solid (non-metallic) red under a thick, glassy clearcoat
    const p = new THREE.MeshPhysicalMaterial({ name: "paint", color: new THREE.Color("#C80000"), metalness: 0.05, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.15 });
    m.dispose();
    return p;
  }
  if (m.name === "calipers") { m.color = new THREE.Color("#F2B600"); m.roughness = 0.45; }
  if (m.isMeshStandardMaterial) {
    if (m.transparent) { m.roughness = 0.02; m.envMapIntensity = 1.6; } // glass reads by its reflections
    else m.envMapIntensity = 1;
  }
  return m;
}

/** The studio the paint reflects: a dark room with a long overhead softbox, two side strips and a red rim light,
 *  baked once into a PMREM cube (no image asset). */
function studio(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const env = new THREE.Scene();
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const add = (geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, k: number, at: [number, number, number], side: THREE.Side = THREE.DoubleSide) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...at); mesh.lookAt(0, 0, 0);
    geos.push(geo); mats.push(mat); env.add(mesh);
    return mesh;
  };
  add(new THREE.SphereGeometry(30, 32, 16), "#0b0b0e", 1, [0, 0, 0], THREE.BackSide);
  add(new THREE.PlaneGeometry(16, 3), "#ffffff", 5.5, [0, 12, 0]); // the overhead softbox: one long highlight down the body
  add(new THREE.PlaneGeometry(3, 16), "#ffffff", 1.6, [0, 11, 4]);
  add(new THREE.PlaneGeometry(12, 1.4), "#fff6ea", 2.6, [-11, 3.5, 2]); // side strips
  add(new THREE.PlaneGeometry(12, 1.4), "#eaf2ff", 2.2, [11, 3.5, -2]);
  add(new THREE.PlaneGeometry(9, 5), "#ff2a14", 1.1, [0, 2, -13]); // rosso rim from behind
  add(new THREE.PlaneGeometry(10, 6), "#fff4ea", 0.45, [8, 4, 9]); // a broad dim fill so the flanks read
  add(new THREE.PlaneGeometry(40, 40), "#17171b", 1, [0, -2, 0]); // the floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose(); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose());
  return rt;
}

/** A soft contact shadow under the car (a rounded-box falloff in a shader), so it sits on the floor without shadow maps. */
function contactShadow(len: number, wid: number): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSize: { value: new THREE.Vector2(wid * 1.6, len * 1.35) }, uHalf: { value: new THREE.Vector2(wid * 0.5, len * 0.5) } },
    vertexShader: "varying vec2 vP; uniform vec2 uSize; void main(){ vP = (uv - .5) * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `varying vec2 vP; uniform vec2 uHalf;
      float box(vec2 p, vec2 b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r; }
      void main(){
        float d = box(vP, uHalf, .35);
        float soft = 1. - smoothstep(-.35, .9, d);
        float core = 1. - smoothstep(-.25, .06, d);
        gl_FragColor = vec4(0., 0., 0., soft * soft * .55 + core * .35);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.renderOrder = 1;
  m.scale.set(wid * 1.6, len * 1.35, 1); // the unit plane spans the falloff's whole box (uSize)
  return m;
}

/** The turntable: a dark brushed disc with a thin red ring at its rim, turning with the car. */
function turntable(r: number): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 96), new THREE.MeshStandardMaterial({ color: "#0b0b0e", metalness: 0.1, roughness: 0.78, envMapIntensity: 0.06 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.992, r, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2a14").multiplyScalar(0.9) }));
  disc.rotation.x = ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  g.add(disc, ring);
  return g;
}

/** Builds the garage in `host` and starts the turntable. Resolves once the car is loaded (or rejects: no WebGL,
 *  a failed fetch, a blocked decoder), so the caller keeps its still. The returned `dispose` is safe to call any time. */
export async function openGarage({ host, input, onProgress, onReady, onFrame }: Opts): Promise<Garage> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps Rosso Corsa's hue (ACES and AgX push it toward orange)
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "co-gl";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const envRT = studio(renderer);
  scene.environment = envRT.texture;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  const rig = new THREE.Group(); // car + shadow + turntable turn together
  scene.add(rig);

  let disposed = false;
  const offs: (() => void)[] = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    offs.forEach((f) => f());
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      for (const m of ([] as THREE.Material[]).concat(mesh.material)) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
    });
    envRT.dispose();
    renderer.dispose();
    renderer.forceContextLoss(); // frees the GPU context now, not whenever GC gets to it
    canvas.remove();
  };

  try {
    const loader = new GLTFLoader();
    await MeshoptDecoder.ready;
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(MODEL_URL, (e) => onProgress(Math.min(0.98, e.loaded / (e.total || MODEL_BYTES))));
    if (disposed) return { dispose };
    const car = gltf.scene;
    car.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(dress) : dress(mesh.material); });
    // normalise: the source is in arbitrary units with its length on Z; centre it, scale to real size, wheels on y = 0
    const box = new THREE.Box3().setFromObject(car), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = CAR_LEN / size.z;
    car.position.set(-c.x * k, -box.min.y * k, -c.z * k);
    car.scale.setScalar(k);
    const wid = size.x * k, hgt = size.y * k;
    rig.add(turntable(CAR_LEN * 0.6), contactShadow(CAR_LEN, wid), car);

    // --- framing, read from the host's CSS so the live car and the lite still sit in the same place ---
    let w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 2), maxDpr = dpr, dist = 12;
    const frame = () => {
      w = host.clientWidth; h = host.clientHeight;
      if (!w || !h) return;
      const cs = getComputedStyle(host), num = (n: string, d: number) => parseFloat(cs.getPropertyValue(n)) || d;
      const cx = num("--co-cx", 0.5), cy = num("--co-cy", 0.6), f = num("--co-f", 0.6);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      dist = fitDistance(CAR_LEN, FOV, w / h, f);
      camera.near = dist * 0.45; camera.far = dist * 2.2; // a tight depth range: the body has inner shells millimetres under the paint
      const [ox, oy] = viewOffset(w, h, cx, cy);
      camera.setViewOffset(w, h, ox, oy, w, h);
      camera.updateProjectionMatrix();
    };
    frame();
    const ro = new ResizeObserver(frame);
    ro.observe(host);
    offs.push(() => ro.disconnect());

    // --- the turntable: auto spin, pointer orbit with inertia, a little camera lift ---
    let yaw = START_YAW, vel = AUTO_SPIN, travel = 0, pitch = 0.16, pitchTo = 0.16;
    let drag: { id: number; x: number; y: number; t: number } | null = null;
    const skip = (t: EventTarget | null) => !!(t as Element | null)?.closest?.("a, button, input, textarea, [data-edit], .ly-hero-copy, .ly-hero-pt, .co-hud");
    const down = (e: PointerEvent) => {
      if (drag || e.button > 0 || skip(e.target)) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      host.dataset.drag = "";
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = performance.now(), dt = Math.max(1, now - drag.t) / 1000, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const d = (dx / Math.max(320, w)) * Math.PI * 1.6; // a full-width drag turns the car most of the way round
      yaw += d; travel += Math.abs(d);
      vel = vel * 0.4 + (d / dt) * 0.6; // smoothed so the release carries the flick, not the last jittery sample
      pitchTo = Math.min(0.42, Math.max(0.05, pitchTo + dy * 0.002));
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    };
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (performance.now() - drag.t > 90) vel = Math.sign(vel || 1) * AUTO_SPIN; // held still before letting go: no flick
      drag = null; delete host.dataset.drag;
    };
    input.addEventListener("pointerdown", down);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    offs.push(() => { input.removeEventListener("pointerdown", down); removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); });

    // --- the loop: only while the hero is on screen and the tab is visible; adaptive resolution ---
    const lap = lapTimer();
    let raf = 0, last = 0, onScreen = true, slow = 0, quick = 0, first = true;
    const render = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!drag) { vel = coast(vel, dt); const d = vel * dt; yaw += d; travel += Math.abs(d); pitchTo += (0.16 - pitchTo) * Math.min(1, dt * 0.6); }
      else if (now - drag.t > 90) vel *= Math.exp(-dt * 6); // held still mid-drag: the engine falls back toward idle
      pitch += (pitchTo - pitch) * Math.min(1, dt * 6);
      rig.rotation.y = yaw;
      camera.position.set(0, hgt * 0.42 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
      camera.lookAt(0, hgt * 0.42, 0);
      renderer.render(scene, camera);
      if (first) { first = false; canvas.style.opacity = "1"; onReady(); }
      // adaptive pixel ratio: step down after a run of slow frames, back up after a long run of quick ones
      if (dt > 0.026) { slow++; quick = 0; } else if (dt < 0.014) { quick++; slow = 0; }
      if (slow > 20 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slow = 0; frame(); }
      if (quick > 240 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.25); quick = 0; frame(); }
      onFrame({ rpm: rpmFor(vel), gear: gearFor(vel), spin: vel, lap: lap(travel, now / 1000) });
      if (onScreen && !document.hidden) raf = requestAnimationFrame(render);
    };
    const kick = () => { if (!raf && onScreen && !document.hidden && !disposed) { last = 0; raf = requestAnimationFrame(render); } };
    const io = new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; kick(); });
    io.observe(host);
    document.addEventListener("visibilitychange", kick);
    offs.push(() => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener("visibilitychange", kick); });

    canvas.style.opacity = "0";
    host.appendChild(canvas);
    onProgress(1);
    kick();
    maxDpr = Math.min(devicePixelRatio || 1, 2);
    return { dispose };
  } catch (err) {
    dispose();
    throw err;
  }
}
