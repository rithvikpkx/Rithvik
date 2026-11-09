/** The one content shape every design renders from (v7 `C`, docs/mockups/v7/content.js). */

export type Place = { key: "home" | "school" | "now"; city: string; tz: string; lat: number; lng: number };

export type ContentProject = {
  slug: string;
  title: string;
  headline: string;
  kind: string;
  icon: string; // Lucide icon name
  ctx: string;
  desc: string[]; // one bullet per entry
  tags: string[];
  links: Record<string, string>; // label → URL, e.g. { GitHub: "https://…" }
};

export type ContentRole = {
  slug: string;
  role: string;
  org: string;
  when: string;
  where: string;
  desc: string[];
  tags: string[];
};

export type Content = {
  name: string;
  first: string;
  last: string;
  initials: string;
  role: string;
  status: string;
  line: string;
  thesis: string[];
  about: string[];
  now: { city: string; tz: string; building: string; researching: string; learning: string };
  places: Place[];
  links: { email: string; github: string; linkedin: string };
  projects: ContentProject[];
  experience: ContentRole[];
  education: { school: string; degree: string; focus: string; grad: string; logo: string };
  stack: Record<string, string[]>;
  faq: [question: string, answer: string][];
  numbers: [value: string, label: string][];
  log: [date: string, kind: string, text: string][];
};
