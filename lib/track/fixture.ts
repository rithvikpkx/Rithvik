/** Fixture rows and a tiny hand-made rrweb recording for the /lab/visitors harness (the real pages need a login and tables). */
import type { EventRow, VisitorRow, VisitRow, ChatLink } from "./views";

const T0 = Date.parse("2026-11-09T14:02:00Z");

export const fixtureVisitor: VisitorRow = {
  id: "123e4567-e89b-12d3-a456-426614174000", first_seen: "2026-11-02T09:14:00Z", last_seen: "2026-11-09T14:09:40Z",
  first_ip: "198.51.100.23", last_ip: "198.51.100.77", ips: ["198.51.100.23", "198.51.100.77"],
  company: "Acme Robotics", org: "Acme Robotics Inc", asn: "AS64500", ip_type: "business",
  city: "San Francisco", region: "CA", country: "US", timezone: "America/Los_Angeles", languages: "en-US,en",
  user_agent: "Mozilla/5.0 (Macintosh) Chrome/130", browser: "Chrome 130", os: "macOS", device: "desktop", screen: "1728x1117@2",
  first_referrer: "https://www.linkedin.com/", first_utm: { utm_source: "linkedin", utm_medium: "profile" },
  email: "ada@acme.example", name: "Ada Recruiter", company_given: "Acme", visits: 3, identified_at: "2026-11-09T14:08:10Z", is_bot: false,
};
export const fixtureVisitors: VisitorRow[] = [
  fixtureVisitor,
  { ...fixtureVisitor, id: "223e4567-e89b-12d3-a456-426614174000", email: null, name: null, company_given: null, company: null, org: "Comcast Cable Communications", ip_type: "isp", city: "Chicago", region: "IL", visits: 1, identified_at: null, last_seen: "2026-11-09T11:30:00Z", browser: "Safari 18", os: "iOS", device: "mobile" },
  { ...fixtureVisitor, id: "323e4567-e89b-12d3-a456-426614174000", email: null, name: null, company_given: null, company: "Purdue University", org: "Purdue University", ip_type: "edu", city: "West Lafayette", region: "IN", visits: 2, identified_at: null, last_seen: "2026-11-08T20:12:00Z" },
  { ...fixtureVisitor, id: "423e4567-e89b-12d3-a456-426614174000", email: null, name: null, company_given: null, company: null, org: "Amazon.com, Inc.", ip_type: "hosting", city: "Ashburn", region: "VA", visits: 1, identified_at: null, last_seen: "2026-11-08T03:00:00Z", is_bot: true },
];

export const fixtureVisit: VisitRow = {
  id: "aaaaaaaa-e89b-12d3-a456-426614174000", visitor_id: fixtureVisitor.id, started_at: "2026-11-09T14:02:00Z", ended_at: "2026-11-09T14:09:40Z",
  ip: "198.51.100.77", entry_url: "/?theme=nimbus", referrer: "https://www.linkedin.com/", utm: { utm_source: "linkedin" }, design: "nimbus",
  viewport: "1440x900", tz: "America/Los_Angeles", lang: "en-US", is_bot: false,
};

const ev = (i: number, secs: number, type: string, data: Record<string, unknown>): EventRow => ({ id: i, visit_id: fixtureVisit.id, at: new Date(T0 + secs * 1000).toISOString(), type, data });
export const fixtureEvents: EventRow[] = [
  ev(1, 0, "pageview", { path: "/", title: "Rithvik Praveen Kumar" }),
  ev(2, 2, "section", { id: "top" }),
  ev(3, 9, "scroll", { pct: 25 }),
  ev(4, 11, "section", { id: "work" }),
  ev(5, 14, "click", { tag: "a", hook: "case", val: "boiler-frame", text: "Boiler Frame" }),
  ev(6, 14, "overlay", { kind: "case", ref: "boiler-frame" }),
  ev(7, 40, "design", { design: "mercury", theme: "mercury" }),
  ev(8, 55, "click", { tag: "a", text: "GitHub", href: "https://github.com/rithvikpkx" }),
  ev(9, 55, "outbound", { host: "github.com", href: "https://github.com/rithvikpkx" }),
  ev(10, 80, "agent_open", { question: "What has he built?" }),
  ev(11, 95, "agent_turn", { q: "Does he have computer vision experience?" }),
  ev(12, 140, "composer_open", { subject: "Hello" }),
  ev(13, 175, "composer_send", { subject: "Perception role" }),
  ev(14, 176, "identify", { email: "ada@acme.example" }),
  ev(15, 177, "active", { ms: 112_000 }),
  ev(16, 178, "error", { msg: "TypeError: x is undefined", src: "/_next/static/chunks/app.js", line: 12 }),
  ev(17, 179, "perf", { lcp: 1180, inp: 96, cls: 0.004 }),
];
export const fixtureChats: ChatLink[] = [{ id: "123e4567-e89b-12d3-a456-426614174999", created_at: "2026-11-09T14:03:20Z", visit_turns: 3, preview: "Does he have computer vision experience?" }];

/** A minimal rrweb recording (page with an input), enough to prove the player renders, plays and shows typed text. */
export const fixtureReplay: unknown[] = [
  { type: 4, timestamp: T0, data: { href: "https://rithvik.ai/", width: 800, height: 420 } },
  {
    type: 2, timestamp: T0 + 10,
    data: {
      initialOffset: { left: 0, top: 0 },
      node: {
        type: 0, id: 1, childNodes: [
          { type: 1, name: "html", publicId: "", systemId: "", id: 2 },
          {
            type: 2, tagName: "html", attributes: {}, id: 3, childNodes: [
              { type: 2, tagName: "head", attributes: {}, id: 4, childNodes: [{ type: 2, tagName: "style", attributes: {}, id: 5, childNodes: [{ type: 3, textContent: "body{font:16px system-ui;margin:0;padding:32px;background:#f6f4ef;color:#222}h1{margin:0 0 12px}input{font:inherit;padding:8px 10px;width:300px;border:1px solid #999;border-radius:8px}button{font:inherit;padding:8px 14px;margin-left:8px}", id: 6 }] }] },
              {
                type: 2, tagName: "body", attributes: {}, id: 7, childNodes: [
                  { type: 2, tagName: "h1", attributes: {}, id: 8, childNodes: [{ type: 3, textContent: "Ask me anything", id: 9 }] },
                  { type: 2, tagName: "input", attributes: { type: "text", placeholder: "Type a question", value: "" }, id: 10, childNodes: [] },
                  { type: 2, tagName: "button", attributes: {}, id: 11, childNodes: [{ type: 3, textContent: "Send", id: 12 }] },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  { type: 3, timestamp: T0 + 500, data: { source: 1, positions: [{ x: 40, y: 40, id: 1, timeOffset: -300 }, { x: 200, y: 110, id: 10, timeOffset: -150 }, { x: 320, y: 116, id: 10, timeOffset: 0 }] } },
  { type: 3, timestamp: T0 + 700, data: { source: 2, type: 2, id: 10, x: 320, y: 116 } },
  ...["W", "Wh", "Wha", "What has he built?"].map((text, i) => ({ type: 3, timestamp: T0 + 1000 + i * 350, data: { source: 5, text, isChecked: false, id: 10 } })),
  { type: 3, timestamp: T0 + 2800, data: { source: 1, positions: [{ x: 330, y: 116, id: 10, timeOffset: -400 }, { x: 420, y: 118, id: 11, timeOffset: 0 }] } },
  { type: 3, timestamp: T0 + 3000, data: { source: 2, type: 2, id: 11, x: 420, y: 118 } },
];
