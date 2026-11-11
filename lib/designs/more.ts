import type { DesignMeta } from "./types";
import { META as clay } from "../../designs/clay/meta.ts"; // relative + .ts: node tests import this

/** Designs added after the original nine. Each lives entirely in designs/<id>/ (its metadata and shader in
 *  designs/<id>/meta.ts); registering it is one import and one entry here. See docs/design-systems.md. */
export const MORE_DESIGNS: DesignMeta[] = [clay];
