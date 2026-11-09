import { ouroPath } from "../mark/ouro";
import type { KGNode } from "@/lib/graph/kg";

const OURO = ouroPath();

/** Node geometry by type (diamond project, triangle role, square school, ringed place, dot otherwise; the ouroboros inside "me"). */
export default function KgShape({ n, markId }: { n: KGNode; markId: string }) {
  const r = n.type === "me" ? 30 : n.type === "skill" ? 4 + Math.min(4, n.deg) : n.type === "field" ? 9 : 7;
  switch (n.type) {
    case "me":
      return (
        <>
          <circle className="kg-shape" r={r} />
          <g className="kg-mark" transform="scale(.34)">
            <mask id={markId} maskUnits="userSpaceOnUse" x="-50" y="-50" width="100" height="100">
              <rect x="-50" y="-50" width="100" height="100" fill="#fff" />
              <circle cx={OURO.eye[0]} cy={OURO.eye[1]} r={OURO.eye[2]} fill="#000" />
            </mask>
            <path d={OURO.d} fill="currentColor" mask={`url(#${markId})`} />
          </g>
        </>
      );
    case "project": return <rect className="kg-shape" x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" />;
    case "role": return <polygon className="kg-shape" points={`0,${-r - 1} ${r + 1},${r} ${-r - 1},${r}`} />;
    case "school": return <rect className="kg-shape" x={-r} y={-r} width={r * 2} height={r * 2} />;
    case "place": return (<><circle className="kg-shape" r={r} /><circle className="kg-ring" r={r + 5} /></>);
    default: return <circle className="kg-shape" r={r} />;
  }
}
