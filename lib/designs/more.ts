import type { DesignMeta } from "./types";
import { META as flux } from "../../designs/flux/meta.ts"; // relative + .ts: node tests import this
import { META as sprawl } from "../../designs/sprawl/meta.ts";
import { META as ember } from "../../designs/ember/meta.ts";
import { META as tide } from "../../designs/tide/meta.ts";
import { META as stone } from "../../designs/stone/meta.ts";
import { META as volt } from "../../designs/volt/meta.ts";
import { META as grove } from "../../designs/grove/meta.ts";

/** Designs added after the original nine. Each lives entirely in designs/<id>/ (its metadata and shader in
 *  designs/<id>/meta.ts); registering it is one import and one entry here. See docs/design-systems.md. */
export const MORE_DESIGNS: DesignMeta[] = [flux, sprawl, ember, tide, stone, volt, grove];
