import type { BuddySessionSummary } from "../../../services/buddyService";

/** A conversation with nothing in it yet: no title until the buddy has had a turn. */
export function blankSession(id: string, createdAt: string): BuddySessionSummary {
  return { id, title: "", projectId: null, createdAt };
}

export function hasBlankTitle(session: BuddySessionSummary): boolean {
  return session.title.trim() === "";
}

/**
 * Which conversation to open for a hire who has some.
 *
 * The one the address names wins — a link must open what it points at — then the one the hire was
 * in, and only then the newest. Either of the first two counts only if the list still holds it.
 */
export function chooseSession(
  sessions: BuddySessionSummary[],
  addressed: string | null,
  previous: string | null,
): string {
  const holds = (id: string | null): id is string =>
    id !== null && sessions.some((session) => session.id === id);

  if (holds(addressed)) return addressed;
  if (holds(previous)) return previous;

  return sessions[0].id;
}

/**
 * The list as a re-read finds it, without what the hire has since binned.
 *
 * A conversation created while the read was in flight is not in what came back, so it is kept in
 * front rather than dropped from the list.
 */
export function mergeFetchedSessions(
  read: BuddySessionSummary[],
  binned: ReadonlySet<string>,
  current: BuddySessionSummary[],
): BuddySessionSummary[] {
  const fetched = read.filter((session) => !binned.has(session.id));
  const fetchedIds = new Set(fetched.map((session) => session.id));
  const createdMeanwhile = current.filter((session) => !fetchedIds.has(session.id));

  return [...createdMeanwhile, ...fetched];
}

/**
 * The conversation "new" should open instead of creating another: the newest one, if it is blank
 * and is not already the one the hire is in.
 */
export function reusableBlankSession(
  sessions: BuddySessionSummary[],
  currentId: string | null,
): BuddySessionSummary | undefined {
  const newest = sessions[0];

  return newest && newest.id !== currentId && hasBlankTitle(newest) ? newest : undefined;
}
