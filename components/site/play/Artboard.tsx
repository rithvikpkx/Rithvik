"use client";
import { useEffect, useRef, useState } from "react";
import { Excalidraw, MainMenu, exportToBlob, exportToClipboard, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useDesign } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import { Icon as Ic } from "../Glyph";

const KEY = "rithvik-artboard";

// Excalidraw builds its font faces on first render, from fonts the postinstall script copies to public/excalidraw/fonts.
// It also appends an esm.sh fallback to every source, and Chrome reports a CSP violation for each blocked one even when
// the self-hosted copy loads, so the fallback is dropped rather than allow-listed.
if (typeof window !== "undefined" && !("EXCALIDRAW_ASSET_PATH" in window)) {
  Object.assign(window, { EXCALIDRAW_ASSET_PATH: "/excalidraw/" });
  const Native = window.FontFace;
  window.FontFace = class extends Native {
    constructor(family: string, src: string | BufferSource, d?: FontFaceDescriptors) {
      super(family, typeof src === "string" ? src.split(/,\s*(?=url\()/).filter((s) => !s.includes("//esm.sh/")).join(", ") : src, d);
    }
  };
}

/** The saved scene, or null when there is none (or storage is blocked). Excalidraw restores/validates it on load. */
function loadScene(): ExcalidrawInitialDataState | null {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}

/** Hands a blob to the browser as a download through a temporary object URL. */
function download(blob: Blob, name: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** The Artboard toy: the Excalidraw editor, themed to the active look, saved locally, with an Export menu and a New action. */
export default function Artboard({ hidden = false }: { hidden?: boolean }) {
  const { entries, current } = useDesign();
  const { toast } = useSite();
  const look = entries.find((e) => e.id === current);
  const dark = !!(look && (look.kind === "design" ? look.meta.dark : look.dark));
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initial] = useState(loadScene);
  const [panel, setPanel] = useState<"export" | "new" | null>(null);
  const [opt, setOpt] = useState({ scale: 2, bg: true, dark, embed: false });
  const save = useRef<(() => void) | null>(null);
  const timer = useRef(0);

  // Flushes a pending save when the window closes, and when the tab is hidden or unloaded.
  useEffect(() => {
    const flush = () => { clearTimeout(timer.current); save.current?.(); save.current = null; };
    addEventListener("pagehide", flush);
    return () => { removeEventListener("pagehide", flush); flush(); };
  }, []);

  /** Debounces a localStorage write of the scene; a quota error (big images) retries without the image files. */
  const onChange: React.ComponentProps<typeof Excalidraw>["onChange"] = (elements, appState, files) => {
    save.current = () => {
      try { localStorage.setItem(KEY, serializeAsJSON(elements, appState, files, "local")); }
      catch { try { localStorage.setItem(KEY, serializeAsJSON(elements, appState, {}, "local")); } catch {} }
    };
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { save.current?.(); save.current = null; }, 600);
  };

  /** Runs one export with the panel's options; reports an empty board or a failure as a toast. */
  const run = async (kind: "png" | "svg" | "copy" | "json") => {
    if (!api) return;
    const elements = api.getSceneElements(), files = api.getFiles();
    if (!elements.length) return toast("Draw something first");
    const appState = { ...api.getAppState(), exportBackground: opt.bg, exportWithDarkMode: opt.dark, exportEmbedScene: opt.embed };
    const dims = (w: number, h: number) => ({ width: w * opt.scale, height: h * opt.scale, scale: opt.scale });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    try {
      if (kind === "png") download(await exportToBlob({ elements, appState, files, mimeType: "image/png", getDimensions: dims }), `artboard-${stamp}.png`);
      else if (kind === "svg") download(new Blob([(await exportToSvg({ elements, appState, files })).outerHTML], { type: "image/svg+xml" }), `artboard-${stamp}.svg`);
      else if (kind === "json") download(new Blob([serializeAsJSON(elements, appState, files, "local")], { type: "application/json" }), `artboard-${stamp}.excalidraw`);
      else { await exportToClipboard({ elements, appState, files, type: "png", getDimensions: dims }); toast("PNG copied"); }
      setPanel(null);
    } catch { toast(kind === "copy" ? "Clipboard blocked by the browser" : "Export failed"); }
  };

  const toggle = (k: "bg" | "dark" | "embed", label: string) => (
    <label className="art-check"><input type="checkbox" checked={opt[k]} onChange={(e) => setOpt({ ...opt, [k]: e.target.checked })} />{label}</label>
  );


  /** Toggles a panel; the export panel starts from the look's light/dark. */
  const show = (p: "export" | "new") => { if (p === "export") setOpt({ ...opt, dark }); setPanel(panel === p ? null : p); };
  const esc = (e: React.KeyboardEvent) => { if (e.key === "Escape") setPanel(null); };

  return (
    <div
      className="play-pane artboard" data-pane="artboard" hidden={hidden}
      // The window is draggable, so Excalidraw's cached canvas offset goes stale; re-measure before the pointer lands.
      onPointerEnter={() => api?.refresh()}
      onPointerDownCapture={(e) => { if (panel && !(e.target as Element).closest(".art-pop, .art-top")) setPanel(null); }}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initial}
        onChange={onChange}
        theme={dark ? "dark" : "light"}
        UIOptions={{ canvasActions: { toggleTheme: false } }}
        // Phones reach these through the menu: in Excalidraw's mobile toolbar they push the tools off-screen.
        renderTopRightUI={(isMobile) => isMobile ? null : (
          <div className="art-top">
            <button type="button" className="art-btn" aria-expanded={panel === "new"} onClick={() => show("new")}><Ic name="plus" />New</button>
            <button type="button" className="art-btn art-primary" aria-expanded={panel === "export"} onClick={() => show("export")}><Ic name="download" />Export</button>
          </div>
        )}
      >
        <MainMenu>
          <MainMenu.Item icon={<Ic name="download" />} onSelect={() => show("export")}>Export…</MainMenu.Item>
          <MainMenu.Item icon={<Ic name="plus" />} onSelect={() => show("new")}>New drawing</MainMenu.Item>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
      {panel === "new" && (
        <div className="art-pop" role="dialog" aria-label="New drawing" onKeyDown={esc}>
          <p>Clear the board? This can&apos;t be undone.</p>
          <div className="art-row">
            <button type="button" className="art-btn art-primary" onClick={() => { api?.resetScene(); try { localStorage.removeItem(KEY); } catch {} setPanel(null); }}>Clear</button>
            <button type="button" className="art-btn" onClick={() => setPanel(null)}>Cancel</button>
          </div>
        </div>
      )}
      {panel === "export" && (
        <div className="art-pop" role="dialog" aria-label="Export" onKeyDown={esc}>
          <div className="art-row" role="radiogroup" aria-label="PNG scale">
            <span className="art-k">Scale</span>
            {[1, 2, 3].map((s) => <button key={s} type="button" role="radio" aria-checked={opt.scale === s} className="art-seg" onClick={() => setOpt({ ...opt, scale: s })}>{s}×</button>)}
          </div>
          {toggle("bg", "Background")}
          {toggle("dark", "Dark mode")}
          {toggle("embed", "Embed scene in SVG")}
          <div className="art-grid">
            <button type="button" className="art-btn art-primary" onClick={() => run("png")}>PNG</button>
            <button type="button" className="art-btn art-primary" onClick={() => run("svg")}>SVG</button>
            <button type="button" className="art-btn" onClick={() => run("copy")}><Ic name="copy" />Copy PNG</button>
            <button type="button" className="art-btn" onClick={() => run("json")}>.excalidraw</button>
          </div>
        </div>
      )}
    </div>
  );
}
