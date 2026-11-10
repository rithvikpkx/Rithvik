import { getContent } from "@/lib/content";
import ArtSheet from "./ArtSheet";

/** Harness for the procedural project art (lib/art): every project in every look. */
export default async function ArtLab() {
  const c = await getContent();
  return <ArtSheet projects={c.projects} />;
}
