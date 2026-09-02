import { BOARD_STAGES, STAGE_LABELS } from "./boardStructure";

/**
 * The named areas a hire has grouped their board's cards into, between visits.
 *
 * Local storage, the same bargain the folded and pinned cards make: there is no endpoint for it,
 * and a preference that follows the machine is closer to right than one that does not exist.
 * Moving it server-side later means replacing the two functions at the bottom.
 *
 * A card belongs to at most one group, and a group is only ever a *display* grouping — the board's
 * own order underneath is untouched, so ungrouping never loses the arrangement it came from.
 */
const STORAGE_VERSION = 1;

export type BoardGroup = {
  id: string;
  name: string;
  /** Members, in no particular order — the board's own order decides how they are laid out. */
  cardIds: string[];
  collapsed: boolean;
};

function storageKey(boardId: string): string {
  return `sprintstart:board-groups:${boardId}`;
}

type StoredGroups = {
  version: number;
  groups: unknown;
};

function isGroup(value: unknown): value is BoardGroup {
  if (typeof value !== "object" || value === null) return false;
  const group = value as Partial<BoardGroup>;

  return (
    typeof group.id === "string" &&
    typeof group.name === "string" &&
    Array.isArray(group.cardIds) &&
    group.cardIds.every((id) => typeof id === "string")
  );
}

/**
 * The groups for this board, or none.
 *
 * Every entry is checked rather than trusted: this is user-writable storage, and a hand-edited or
 * half-written entry must not be able to take the board down.
 */
export function readBoardGroups(boardId: string): BoardGroup[] {
  if (!boardId) return [];

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as StoredGroups;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.groups)) return [];

    return mergeSameName(
      parsed.groups.filter(isGroup).map((group) => ({
        ...group,
        name: unsplitTeamArea(group.name),
        collapsed: !!group.collapsed,
      })),
    );
  } catch {
    return [];
  }
}

/** What the generator calls the area holding a team's card blueprints. */
const TEAM_AREA = "From your team";

/**
 * The name of an area, with a stage suffix the generator used to add taken back off.
 *
 * Generated areas carried their stage in their *name* — "From your team — Now", "— Next", "— Later"
 * — because a plan's stage used to live on the area rather than on the card. That is fixed at the
 * source, but a hire who generated their board before the fix still has the three areas sitting in
 * their storage, and three tab stops for one set of cards is exactly what the fix was for.
 *
 * A read rather than a migration with a version bump: bumping the version discards everything the
 * old version wrote, which here is every area the hire ever made by hand. This renames the two or
 * three the generator made and leaves the rest alone.
 */
function unsplitTeamArea(name: string): string {
  // Only the three names the generator could actually produce. "From your team — my copy" is a
  // hire naming their own area, and renaming that would be this function editing somebody's words.
  const split = BOARD_STAGES.some(
    (stage) => name === `${TEAM_AREA} \u2014 ${STAGE_LABELS[stage].title}`,
  );

  return split ? TEAM_AREA : name;
}

/**
 * Areas sharing a name folded into one, keeping the first one's place and id.
 *
 * Two areas with the same name are indistinguishable in the section bar — two tabs, same word — so
 * whatever put them there, the board is better off with one. It happens two ways: the stage-split
 * names above collapsing onto each other, and a second generation run that made a new area instead
 * of adding to the one it made the first time.
 */
function mergeSameName(groups: BoardGroup[]): BoardGroup[] {
  const merged: BoardGroup[] = [];

  for (const group of groups) {
    const existing = merged.find((candidate) => candidate.name === group.name);
    if (!existing) {
      merged.push({ ...group, cardIds: [...group.cardIds] });
      continue;
    }

    for (const cardId of group.cardIds) {
      if (!existing.cardIds.includes(cardId)) existing.cardIds.push(cardId);
    }
  }

  return merged;
}

/** Stores the groups. A storage that refuses is not a reason to lose them on screen. */
export function writeBoardGroups(boardId: string, groups: BoardGroup[]): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, groups } satisfies StoredGroups),
    );
  } catch {
    // Nothing to do and nothing to say: the grouping still holds for this visit.
  }
}

/** Which group a card is in, or null. */
export function groupOf(groups: BoardGroup[], cardId: string): BoardGroup | null {
  return groups.find((group) => group.cardIds.includes(cardId)) ?? null;
}

/**
 * Puts a card in a group, taking it out of whatever group it was in.
 *
 * `groupId` of null means "no group". A group left with nothing in it is dropped rather than kept
 * as an empty box: the name was for the cards, and there are none.
 */
export function assignToGroup(
  groups: BoardGroup[],
  cardId: string,
  groupId: string | null,
): BoardGroup[] {
  return groups
    .map((group) => ({
      ...group,
      cardIds:
        group.id === groupId
          ? [...group.cardIds.filter((id) => id !== cardId), cardId]
          : group.cardIds.filter((id) => id !== cardId),
    }))
    .filter((group) => group.cardIds.length > 0);
}
