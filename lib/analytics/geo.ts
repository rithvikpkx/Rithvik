/** Country names and approximate centroids for the globes (pure). Rows without coordinates of their own are drawn
 *  at their country's centroid; a country missing here is listed but not drawn.
 *  shortcut: ~120 common countries by hand, rounded to a degree; add a row when an unlisted country shows up. */
import type { GeoPoint } from "./types";

const RAW =
  "US:39.8,-98.6;CA:56.1,-106.3;MX:23.6,-102.6;BR:-14.2,-51.9;AR:-38.4,-63.6;CL:-35.7,-71.5;CO:4.6,-74.3;PE:-9.2,-75;VE:6.4,-66.6;" +
  "EC:-1.8,-78.2;UY:-32.5,-55.8;PY:-23.4,-58.4;BO:-16.3,-63.6;CR:9.7,-83.8;PA:8.5,-80.8;GT:15.8,-90.2;DO:18.7,-70.2;CU:21.5,-77.8;PR:18.2,-66.6;JM:18.1,-77.3;" +
  "GB:54,-2.5;IE:53.4,-8.2;FR:46.2,2.2;DE:51.2,10.4;NL:52.1,5.3;BE:50.5,4.5;LU:49.8,6.1;CH:46.8,8.2;AT:47.5,14.6;ES:40.5,-3.7;PT:39.4,-8.2;IT:41.9,12.6;" +
  "DK:56.3,9.5;NO:60.5,8.5;SE:60.1,18.6;FI:61.9,25.7;IS:65,-19;PL:51.9,19.1;CZ:49.8,15.5;SK:48.7,19.7;HU:47.2,19.5;RO:45.9,25;BG:42.7,25.5;GR:39.1,21.8;" +
  "HR:45.1,15.2;SI:46.2,14.8;RS:44,21;BA:43.9,17.7;AL:41.2,20.2;MK:41.6,21.7;UA:48.4,31.2;BY:53.7,28;MD:47.4,28.4;LT:55.2,23.9;LV:56.9,24.6;EE:58.6,25;" +
  "RU:61.5,105.3;TR:39,35.2;CY:35.1,33.4;MT:35.9,14.4;GE:42.3,43.4;AM:40.1,45;AZ:40.1,47.6;KZ:48,66.9;UZ:41.4,64.6;" +
  "IL:31,34.9;PS:31.9,35.2;JO:30.6,36.2;LB:33.9,35.9;SA:23.9,45.1;AE:23.4,53.8;QA:25.4,51.2;KW:29.3,47.5;BH:26,50.6;OM:21.5,55.9;IR:32.4,53.7;IQ:33.2,43.7;" +
  "EG:26.8,30.8;MA:31.8,-7.1;DZ:28,1.7;TN:33.9,9.5;NG:9.1,8.7;GH:7.9,-1;KE:-0,37.9;ET:9.1,40.5;TZ:-6.4,34.9;UG:1.4,32.3;RW:-1.9,29.9;ZA:-30.6,22.9;" +
  "SN:14.5,-14.5;CI:7.5,-5.5;CM:7.4,12.4;ZW:-19,29.2;ZM:-13.1,27.8;" +
  "IN:20.6,79;PK:30.4,69.3;BD:23.7,90.4;LK:7.9,80.8;NP:28.4,84.1;CN:35.9,104.2;HK:22.3,114.2;TW:23.7,121;MO:22.2,113.5;JP:36.2,138.3;KR:35.9,127.8;" +
  "MN:46.9,103.8;SG:1.35,103.8;MY:4.2,102;TH:15.9,101;VN:14.1,108.3;PH:12.9,121.8;ID:-0.8,113.9;KH:12.6,105;MM:21.9,96;" +
  "AU:-25.3,133.8;NZ:-40.9,174.9";

const CENTROIDS = new Map<string, [number, number]>(
  RAW.split(";").map((r) => { const [c, ll] = r.split(":"); const [a, b] = ll.split(",").map(Number); return [c, [a, b]]; }),
);

/** [lat, lng] of a country (ISO 3166 alpha-2), or null when unknown. */
export function centroid(code: string | null | undefined): [number, number] | null {
  return (code && CENTROIDS.get(code.toUpperCase())) || null;
}

let names: Intl.DisplayNames | null = null;
/** "US" -> "United States"; the code itself when the runtime has no name for it. */
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

type CityRow = { city: string | null; region: string | null; country: string | null; lat: number | null; lng: number | null; value: number };

/** Globe points from city rows: a row's own coordinates, else its country's centroid; rows landing on the same spot
 *  (every coordinate-less city of one country) merge into one point. */
export function toPoints(rows: CityRow[]): GeoPoint[] {
  const out = new Map<string, GeoPoint>();
  for (const r of rows) {
    const own = typeof r.lat === "number" && typeof r.lng === "number";
    const ll = own ? [r.lat!, r.lng!] : centroid(r.country);
    if (!ll) continue;
    const label = own && r.city ? [r.city, r.region, r.country].filter(Boolean).join(", ") : r.country ? countryName(r.country) : "Unknown";
    const key = `${ll[0].toFixed(1)},${ll[1].toFixed(1)}`;
    const p = out.get(key);
    if (p) p.value += r.value;
    else out.set(key, { lat: ll[0], lng: ll[1], value: r.value, label });
  }
  return [...out.values()].sort((a, b) => b.value - a.value);
}
