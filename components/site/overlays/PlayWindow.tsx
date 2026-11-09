"use client";
import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PLAY } from "@/lib/play/games";
import { useSite } from "../SiteProvider";
import { Icon as Ic } from "../Glyph";
import "../play/play.css";

// Each toy is its own chunk, so Web Audio and canvas code only load when its tab first opens.
const Records = dynamic(() => import("../play/Records"), { ssr: false });
const Artboard = dynamic(() => import("../play/Artboard"), { ssr: false });
const GAME_VIEWS = {
  typeracer: dynamic(() => import("../play/TypeRacer"), { ssr: false }),
  angle: dynamic(() => import("../play/Angle"), { ssr: false }),
  dots: dynamic(() => import("../play/Dots"), { ssr: false }),
  center: dynamic(() => import("../play/CenterDiv"), { ssr: false }),
} as const;

const indexOf = (id?: string) => Math.max(0, PLAY.findIndex((p) => p.id === id));

/** The Play window: a draggable, non-modal window with one tab per toy. Only the open tab is mounted (the Artboard stays once visited so a drawing survives a tab switch). */
export default function PlayWindow({ initialId }: { initialId?: string }) {
  const { close } = useSite();
  const [idx, setIdx] = useState(() => indexOf(initialId));
  const [prevInitial, setPrevInitial] = useState(initialId);
  const [artSeen, setArtSeen] = useState(PLAY[indexOf(initialId)].id === "artboard");
  const win = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLElement>(null);
  const drag = useRef<[number, number] | null>(null);

  // A data-play click on another toy while the window is open retargets the tab.
  if (initialId !== prevInitial) { setPrevInitial(initialId); setIdx(indexOf(initialId)); }
  const active = PLAY[idx].id;
  if (active === "artboard" && !artSeen) setArtSeen(true);

  // Centres the window on first open (desktop only; phones get the CSS bottom sheet). Offset sizes ignore the opening scale animation.
  useLayoutEffect(() => {
    const w = win.current;
    if (!w || innerWidth <= 640) return;
    const ww = w.offsetWidth, wh = w.offsetHeight;
    w.style.left = Math.max(8, Math.min(innerWidth - ww - 8, (innerWidth - ww) / 2)) + "px";
    w.style.top = Math.max(76, Math.min(innerHeight - wh - 8, (innerHeight - wh) / 2)) + "px";
  }, []);

  // Puts keyboard focus on the open tab so Escape and arrow keys work immediately.
  useEffect(() => { tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true }); }, []);

  /** Roving tabindex: arrows/Home/End move focus and select (automatic activation). */
  const onTabKey = (e: React.KeyboardEvent) => {
    const to = { ArrowRight: (idx + 1) % PLAY.length, ArrowLeft: (idx + PLAY.length - 1) % PLAY.length, Home: 0, End: PLAY.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setIdx(to);
    tabs.current?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
  };

  const View = (GAME_VIEWS as Record<string, React.ComponentType | undefined>)[active];
  return (
    <section ref={win} className="win play-win front" aria-label="Play" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <header
        className="win-bar"
        onPointerDown={(e) => {
          const w = win.current;
          if (!w || (e.target as Element).closest("button") || innerWidth <= 640) return;
          drag.current = [e.clientX - w.offsetLeft, e.clientY - w.offsetTop];
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const w = win.current, d = drag.current;
          if (!w || !d) return;
          w.style.left = Math.max(80 - w.offsetWidth, Math.min(innerWidth - 80, e.clientX - d[0])) + "px";
          w.style.top = Math.max(8, Math.min(innerHeight - 48, e.clientY - d[1])) + "px";
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <span className="win-title"><Ic name="gamepad-2" />Play</span>
        <nav className="play-tabs" ref={tabs} role="tablist" aria-label="Toys" onKeyDown={onTabKey}>
          {PLAY.map((p, i) => (
            <button key={p.id} type="button" role="tab" id={`play-tab-${p.id}`} aria-selected={i === idx} aria-controls="play-panel" tabIndex={i === idx ? 0 : -1} title={p.desc} onClick={() => setIdx(i)}>
              <Ic name={p.icon} /><span>{p.name}</span>
            </button>
          ))}
        </nav>
        <span className="win-actions"><button type="button" className="ui-ic" aria-label="Close" onClick={close}><Ic name="x" /></button></span>
      </header>
      <div className="play-body" id="play-panel" role="tabpanel" aria-labelledby={`play-tab-${active}`}>
        {active === "records" && <div className="play-pane" data-pane="records"><Records /></div>}
        {artSeen && <Artboard hidden={active !== "artboard"} />}
        {View && <div className="play-pane" data-pane="game"><div className="gf-body"><View /></div></div>}
      </div>
    </section>
  );
}
