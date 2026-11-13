import Lab from "./Lab";

/** Harness for the look picker. `?extra=N` (default 16, max 80) sets how many fake palettes join the real designs. */
export default async function Page({ searchParams }: { searchParams: Promise<{ extra?: string }> }) {
  const { extra } = await searchParams;
  return <Lab extra={Math.min(80, Math.max(0, Number(extra ?? 16) || 0))} />;
}
