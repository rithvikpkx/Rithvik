"use client";
import { useEffect } from "react";
import { useSite } from "../SiteProvider";

/** Renders nothing; opens the case sheet for `slug` on mount (deep link /work/<slug>). */
export default function OpenCase({ slug }: { slug: string }) {
  const { openCase } = useSite();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openCase changes identity per render; open once
  useEffect(() => { openCase(slug); }, [slug]);
  return null;
}
