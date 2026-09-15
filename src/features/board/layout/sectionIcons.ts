import type { LucideIcon } from "lucide-react";
import {
  CircleCheckBig,
  CircleSlash,
  FolderOpen,
  Highlighter,
  Layers,
  ListChecks,
} from "lucide-react";

import { FOCUS_SECTION, LOOSE_SECTION, type SectionSummary } from "./boardSections";

/**
 * The glyph a section carries, wherever it is drawn.
 *
 * One function rather than one per surface: the same section drawn with two different icons on two
 * widths of the same page is the page contradicting itself, and that is exactly what happens the
 * second time somebody adds a section kind and updates one of the two lists. Beside `cardIcons.ts`
 * for the same reason it exists — how a thing is drawn belongs with the thing, not with one of the
 * components that draws it.
 *
 * A finished section is marked as finished rather than as what it is, because "nothing left here"
 * is the more useful fact at a glance; the name beside it still says which section it is.
 */
export function sectionIcon(section: SectionSummary): LucideIcon {
  // Before the finished check, and deliberately: a highlight row is *what the cut is*, and a row of
  // marked cards that happen to all be ticked off is still the highlight row. Losing the pen for a
  // tick would make the one cut on this bar that is not a place look like one that is.
  if (section.mark) return Highlighter;
  if (section.total > 0 && section.done === section.total) return CircleCheckBig;
  if (section.id === null) return Layers;
  if (section.id === FOCUS_SECTION) return ListChecks;
  if (section.id === LOOSE_SECTION) return CircleSlash;

  return FolderOpen;
}
