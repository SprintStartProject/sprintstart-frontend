import type { LucideIcon } from "lucide-react";
import { Bot, User } from "lucide-react";

import type { BoardCard } from "../types";

/**
 * Which cards to show, by *where they came from*.
 *
 * There used to be a third, "team", for the cards a PM's card blueprints put here. Card blueprints
 * and the generator that wrote those cards are gone -- onboarding is the path on its own page -- so a
 * checklist a hire has is theirs, whoever's idea it first was.
 *
 * Neither cut has an equivalent among the sections: nobody files cards into an area by who wrote
 * them.
 */
export type BoardFilter = "all" | "buddy" | "mine";

/**
 * The cuts, in the order they are offered — and there is no option here for *not* cutting.
 *
 * There used to be one, "All cards", and it was a button whose whole job was to undo the two beside
 * it: a board with nothing pressed already shows every card, so the switch was lit by default and
 * did nothing when pressed. Now the two that cut something are toggles — pressing the lit one puts
 * the board back — which is how every other switch in this rail behaves, the colour dots included.
 *
 * The way back is also written out where the result of the cut is: `BoardViewStatus` names the cut
 * above the board and offers "Show everything", which clears this and the section and the focus
 * view together. Two ways back for a state somebody set on purpose is enough; a third that is on
 * screen permanently is a control paying rent for a job the other two already do.
 *
 * A fixed list rather than one built from the board. They used to be conditional — "From your team"
 * only appeared once a team card existed — which made sense for a value that could apply to
 * nothing. These two always can: a hire with no buddy cards learns something true from an empty
 * result, and a control that grows an option the first time the generator runs is a control that
 * moves under the pointer.
 */
export const FILTER_OPTIONS: {
  value: Exclude<BoardFilter, "all">;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "buddy", label: "From your buddy", icon: Bot },
  { value: "mine", label: "Yours", icon: User },
];

export function matchesFilter(card: BoardCard, filter: BoardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "buddy") return card.owner === "AI";

  return card.owner === "HIRE";
}

/** The label of the cut currently in force, or null when nothing is cut away. */
export function filterLabel(filter: BoardFilter): string | null {
  if (filter === "all") return null;

  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? null;
}
