/** Splits a display value like "500+" into prefix "", number 500, suffix "+"; null when it has no leading number. */
export function parseCount(v: string): { pre: string; n: number; post: string } | null {
  const m = v.match(/^(\D*?)(\d[\d,]*)(.*)$/);
  return m ? { pre: m[1], n: Number(m[2].replace(/,/g, "")), post: m[3] } : null;
}
