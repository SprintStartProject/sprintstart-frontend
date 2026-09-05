import type { LucideIcon } from "lucide-react";
import { Bot, Layers, User } from "lucide-react";

import { sourceOfTitle } from "../generation/pathToCards";
import type { BoardCard } from "../types";

/**
 * Which cards to show, by *where they came from*.
 *
 * There used to be a fourth, "team", for the cards the project's blueprints put here. It is gone,
 * and the section bar is why: the generator files those cards into an area called "From your team",
 * so the filter and the bar were two controls cutting the same set — under the same words, from two
 * different facts. The bar's is the better of the two. It cuts on where a card actually *is*, which
 * is a thing a person can see and change; the filter's cut on an invisible marker in the card's
 * title (see `generation/pathToCards.ts`, and the TODO to take it away), so the two disagreed the
 * moment somebody moved a card out of the area.
 *
 * What is left has no equivalent among the sections: nobody files cards into an area by who wrote
 * them.
 */
export type BoardFilter = "all" | "buddy" | "mine";

/**
 * The three cuts, in the order they are offered.
 *
 * Fixed rather than built from what is on the board. They used to be conditional — "From your team"
 * only appeared once a team card existed — which made sense for a value that could apply to
 * nothing. These three always can: "All cards" is every board, and a hire with no buddy cards
 * learns something true from an empty result. A control that grows an option the first time the
 * generator runs is a control that moves under the pointer.
 */
export const FILTER_OPTIONS: { value: BoardFilter; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "All cards", icon: Layers },
  { value: "buddy", label: "From your buddy", icon: Bot },
  { value: "mine", label: "Yours", icon: User },
];

/**
 * Whether a card came from the project's blueprints rather than from the hire or their buddy.
 *
 * Read off the invisible marker its title carries — see `generation/pathToCards.ts`, which explains
 * why provenance is smuggled through a text field and what should replace it.
 */
export function isFromTeam(card: BoardCard): boolean {
  return card.content.kind === "CHECKLIST" && sourceOfTitle(card.content.title) === "TEAM";
}

export function matchesFilter(card: BoardCard, filter: BoardFilter): boolean {
  if (filter === "all") return true;
  if (filter === "buddy") return card.owner === "AI";

  // "Yours" still means yours: a blueprint card is stored as the hire's so they can edit it, but
  // the team wrote it. Those are reached through their area, which is where they were put.
  return card.owner === "HIRE" && !isFromTeam(card);
}

/** The label of the cut currently in force, or null when nothing is cut away. */
export function filterLabel(filter: BoardFilter): string | null {
  if (filter === "all") return null;

  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? null;
}
