import SiteProvider from "@/components/site/SiteProvider";
import { fixture } from "@/lib/content/fixture";
import { PLAY } from "@/lib/play/games";
import "./lab.css";

/** Harness for the Play window: one data-play button per toy (SiteProvider wires the clicks). */
export default function PlayLab() {
  return (
    <SiteProvider content={fixture}>
      <div className="lab-bar">
        {PLAY.map((p) => <button key={p.id} type="button" data-play={p.id}>{p.name}</button>)}
      </div>
    </SiteProvider>
  );
}
