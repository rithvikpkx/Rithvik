"use client";
import { useEffect, type RefObject } from "react";
import { MAX_RPM, deltaText, lapClock, revLights, rpmUnit } from "./telemetry";
import type { Garage, Telemetry } from "./scene";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** Corsa's mount(): opens the three.js garage in the hero (lazy: three.js and the model load only now, never under
 *  calm), shows the loading state until the first frame, feeds the instruments (rev lights, gear, rpm, lap timing,
 *  the tach around the portrait) from the turntable, and tears the scene down completely on unmount, on a switch
 *  to performance mode, or on failure (the designed still stays). */
export function useCorsaMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    const stage = el?.querySelector<HTMLElement>("#co-stage"), hero = el?.querySelector<HTMLElement>("#top");
    if (!el || !stage || !hero) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const hud = $<HTMLElement>(".co-hud"), tach = $<HTMLElement>(".co-tach");
    const gearEl = $<HTMLElement>("#co-gear"), rpmEl = $<HTMLElement>("#co-rpm"), lapEl = $<HTMLElement>("#co-lap"), dEl = $<HTMLElement>("#co-delta"), nEl = $<HTMLElement>("#co-lapn");

    let garage: Garage | null = null, opening = false, alive = true, lastTxt = 0, lastU = -1;
    /** Writes one frame of telemetry: the needle and rev lights every frame (CSS vars on two small elements), the
     *  numbers at a dash-display rate. */
    const show = (t: Telemetry) => {
      const u = rpmUnit(t.rpm);
      if (Math.abs(u - lastU) > 0.002) {
        lastU = u;
        hud?.style.setProperty("--rpm", u.toFixed(3));
        hud?.style.setProperty("--lit", String(revLights(t.rpm)));
        tach?.style.setProperty("--rpm", u.toFixed(3));
        hud?.toggleAttribute("data-limit", t.rpm > MAX_RPM * 0.95); // on the limiter: the rev lights flash
      }
      const now = performance.now();
      if (now - lastTxt < 90) return;
      lastTxt = now;
      if (gearEl) gearEl.textContent = String(t.gear);
      if (rpmEl) rpmEl.textContent = String(Math.round(t.rpm / 10) * 10);
      if (lapEl) lapEl.textContent = lapClock(t.lap.t);
      if (nEl) nEl.textContent = String(t.lap.n + 1).padStart(2, "0");
      if (dEl && t.lap.n > 0) {
        dEl.textContent = t.lap.n > 1 ? deltaText(t.lap.delta) : lapClock(t.lap.last);
        dEl.dataset.k = t.lap.fast ? "best" : t.lap.delta < 0 ? "up" : "down";
      }
    };

    /** Loads three.js + the car and starts the turntable, unless calm or already open. */
    const open = async () => {
      if (garage || opening || calm()) return;
      opening = true;
      stage.dataset.state = "loading";
      try {
        const { openGarage } = await import("./scene");
        if (!alive || calm()) { opening = false; delete stage.dataset.state; return; }
        const g = await openGarage({
          host: stage, input: hero,
          onProgress: (p) => stage.style.setProperty("--load", p.toFixed(3)),
          onReady: () => { stage.dataset.state = "live"; },
          onFrame: show,
        });
        if (!alive || calm()) g.dispose(); else garage = g;
      } catch (e) {
        console.warn("[corsa] garage unavailable, keeping the still", e);
        stage.dataset.state = "still";
      }
      opening = false;
    };
    /** Tears the scene down and returns to the still. */
    const close = () => {
      garage?.dispose(); garage = null;
      delete stage.dataset.state;
      hud?.style.removeProperty("--rpm"); hud?.style.removeProperty("--lit"); tach?.style.removeProperty("--rpm");
    };

    open();
    // performance mode can be toggled at any time: close the garage for it, reopen when it is turned off
    const mo = new MutationObserver(() => { if (calm()) close(); else open(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => { alive = false; mo.disconnect(); close(); };
  }, [root]);
}
