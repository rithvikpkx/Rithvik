/** Pure normaliser for ipinfo.io responses (free, Lite and paid shapes) into the columns we store. */
import { clip } from "./schema.ts";

export type IpType = "business" | "isp" | "hosting" | "edu";
export type Enriched = { company: string | null; org: string | null; asn: string | null; ip_type: IpType | null; city: string | null; region: string | null; country: string | null; timezone: string | null };

const HOSTING = /amazon|aws|google (cloud|llc)|microsoft|azure|digitalocean|hetzner|ovh|linode|akamai|vultr|cloudflare|oracle|alibaba|tencent|scaleway|leaseweb|choopa|hosting|datacenter|data center|colo|vpn|proxy|m247|packet|rackspace|fastly|zscaler|contabo/i;
const ISP = /comcast|xfinity|verizon|at&t|att services|spectrum|charter|cox comm|centurylink|lumen|frontier|t-mobile|sprint|telecom|telekom|telefonica|vodafone|orange|bt group|virgin media|sky broadband|jio|airtel|bsnl|broadband|cable|wireless|mobile|internet service|communications|fiber|isp|bell canada|rogers|telus|optus|telstra|singtel|docomo|kddi/i;
const EDU = /universit|college|school|institute of technology|\.edu|academic|education|research network/i;

/** Splits ipinfo's "AS15169 Google LLC" org string. */
function splitOrg(org: string | null): { asn: string | null; name: string | null } {
  const m = org?.match(/^(AS\d+)\s+(.+)$/);
  return m ? { asn: m[1], name: m[2] } : { asn: null, name: org };
}

/** business | isp | hosting | edu from ipinfo's own type when present, else from the network name. */
export function classify(name: string | null, given?: unknown): IpType | null {
  if (typeof given === "string") {
    const g = given.toLowerCase();
    if (g === "education" || g === "edu") return "edu";
    if (g === "business" || g === "isp" || g === "hosting") return g;
  }
  if (!name) return null;
  if (EDU.test(name)) return "edu";
  if (HOSTING.test(name)) return "hosting";
  if (ISP.test(name)) return "isp";
  return "business";
}

/** Maps any ipinfo response to our columns. `company` is set only when the network belongs to an organisation
 *  (business, edu, or paid-plan company data); an ISP or hosting range says nothing about who the visitor works for. */
export function normalizeIpinfo(j: unknown): Enriched {
  const o = (j && typeof j === "object" ? j : {}) as Record<string, unknown>;
  const asnObj = o.asn && typeof o.asn === "object" ? (o.asn as Record<string, unknown>) : null;
  const company = o.company && typeof o.company === "object" ? (o.company as Record<string, unknown>) : null;
  const split = splitOrg(clip(o.org, 200));
  const asn = clip(asnObj?.asn, 20) ?? (typeof o.asn === "string" ? clip(o.asn, 20) : null) ?? split.asn;
  const org = clip(asnObj?.name, 200) ?? clip(o.as_name, 200) ?? split.name;
  const ip_type = classify(clip(company?.name, 200) ?? org, company?.type ?? asnObj?.type);
  const companyName = clip(company?.name, 200);
  return {
    company: companyName ?? (ip_type === "business" || ip_type === "edu" ? org : null),
    org, asn, ip_type,
    city: clip(o.city, 80), region: clip(o.region, 80), country: clip(o.country, 80) ?? clip(o.country_code, 8),
    timezone: clip(o.timezone, 60),
  };
}
