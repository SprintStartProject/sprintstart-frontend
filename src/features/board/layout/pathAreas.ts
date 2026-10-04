import type { OnboardingPathEndpoint } from "../../onboarding/types";
import type { BoardCard } from "../types";
import type { BoardGroup } from "./boardGroups";
import type { CardOrigins } from "./cardOrigins";
import { phaseOfCard, type PathPhases } from "./pathStages";

/**
 * Areas the board makes by itself, one per phase of the onboarding path.
 *
 * Areas used to be the hire's to make by hand, and almost nobody did: a box has to be named and
 * filled before it is worth anything, and the obvious way to divide an onboarding board — by the
 * part of the onboarding a card belongs to — is already written down in the path. So every card
 * tied to a phase (see `pathStages.ts`) is filed under that phase, unless the hire put it in an
 * area of their own: a decision somebody made beats one the board guessed.
 *
 * **Never stored.** They are drawn from the path on every render and never written with the
 * hire's areas, so they cannot go stale when the path is rebuilt, and turning the idea off is
 * deleting this file's one caller. Renaming one is how it becomes the hire's: it is then written
 * as an ordinary area, under the new name, with the cards it held.
 */
const PATH_AREA_PREFIX = "path-phase:";

/** Whether an area is one of these rather than one the hire made. */
export function isPathArea(groupId: string): boolean {
  return groupId.startsWith(PATH_AREA_PREFIX);
}

/**
 * One area per phase that has cards to hold, in path order.
 *
 * `collapsedIds` is the page's own record of which of them are folded — these have nowhere to keep
 * that, being rebuilt each time.
 */
export function pathAreas(
  cards: readonly BoardCard[],
  ownAreas: readonly BoardGroup[],
  path: OnboardingPathEndpoint | null,
  phases: PathPhases | null,
  origins: CardOrigins,
  collapsedIds: ReadonlySet<string>,
): BoardGroup[] {
  if (!path || !phases) return [];

  const filed = new Set(ownAreas.flatMap((area) => area.cardIds));
  const byPhase = new Map<string, string[]>();

  for (const card of cards) {
    // The live step card stays out: it is the path showing on the board, and boxing it under its
    // own phase's name would bury the one card that says where the hire is.
    if (filed.has(card.id) || card.content.kind === "PATH_STEP") continue;

    const phaseId = phaseOfCard(card, phases, origins);
    if (!phaseId) continue;

    byPhase.set(phaseId, [...(byPhase.get(phaseId) ?? []), card.id]);
  }

  return [...path.phases]
    .sort((left, right) => left.position - right.position)
    .filter((phase) => byPhase.has(phase.id))
    .map((phase) => {
      const id = `${PATH_AREA_PREFIX}${phase.id}`;
      return {
        id,
        name: phase.title,
        cardIds: byPhase.get(phase.id) ?? [],
        collapsed: collapsedIds.has(id),
      };
    });
}
