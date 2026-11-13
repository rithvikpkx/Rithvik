"use client";
import { htmlAttrsFor } from "@/lib/designs/registry";
import { loadedDesign, useDesign } from "./DesignProvider";
import { useSite } from "./SiteProvider";

/** Renders the active design. The server-rendered one arrives as `children` (so first paint is the
 *  right site); any other was loaded by setDesign before it became current. */
export default function ActiveDesign({ initial, children }: { initial: string; children: React.ReactNode }) {
  const { current } = useDesign();
  const { content } = useSite();
  const layoutId = htmlAttrsFor(current).design;
  if (layoutId === htmlAttrsFor(initial).design) return children;
  const Design = loadedDesign(layoutId);
  // eslint-disable-next-line react-hooks/static-components -- module-cached, identity is stable per id
  return Design ? <Design content={content} /> : children;
}
