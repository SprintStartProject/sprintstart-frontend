import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import type { CardOrigin } from "./cardOrigins";

/**
 * Which finished phases the hire has already been offered a recap for, and the recap being asked
 * for right now.
 *
 * Local storage, per board, and deliberately not part of the synced arrangement: it only decides
 * whether a one-line offer is shown, and seeing that offer once more on a second machine costs
 * nothing. Moving it server-side would mean replacing the two functions below.
 */
const STORAGE_VERSION = 1;

/** How long after asking a reply kept from the dock still counts as the recap. */
const RECAP_WINDOW_MS = 15 * 60 * 1000;

function storageKey(boardId: string): string {
  return `sprintstart:board-phase-recaps:${boardId}`;
}

type Stored = { version: number; ids: unknown };

/** The phases already offered — answered or waved away — for this board. Never throws. */
export function readOfferedRecaps(boardId: string): Set<string> {
  if (!boardId) return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (!raw) return new Set();

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.ids)) return new Set();

    return new Set(parsed.ids.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Remembers that a phase's recap was offered. A storage that refuses is ignored. */
export function writeOfferedRecaps(boardId: string, ids: ReadonlySet<string>): void {
  if (!boardId) return;

  try {
    window.localStorage.setItem(
      storageKey(boardId),
      JSON.stringify({ version: STORAGE_VERSION, ids: [...ids] } satisfies Stored),
    );
  } catch {
    // The offer comes back next visit, which is the whole cost.
  }
}

let pending: { phaseId: string; title: string; until: number } | null = null;

/**
 * Marks the next reply kept from the buddy as the recap of this phase.
 *
 * The recap is asked for from the board but written in the dock, and kept from there with the
 * dock's own button — which knows nothing about phases. So the board leaves word here, and the next
 * save without an origin of its own picks it up (see `onboardingOrigin.ts`): the recap is then tied
 * to the phase it is about and files under *Behind you* with the rest of it.
 */
export function expectRecap(phaseId: string, title: string): void {
  pending = { phaseId, title, until: Date.now() + RECAP_WINDOW_MS };
}

/** The origin for a recap being kept now, once: taking it clears it. */
export function takeRecapOrigin(): CardOrigin | null {
  const recap = pending;
  pending = null;

  if (!recap || Date.now() > recap.until) return null;

  return {
    url: onboardingPlaceUrl({ kind: "phase", id: recap.phaseId }),
    label: `Recap of ${recap.title}`,
  };
}
