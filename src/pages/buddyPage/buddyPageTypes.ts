import type { useBuddySession } from "../../features/buddy/buddySessionContext";

/** Everything the one shared buddy session offers the page. */
export type BuddySession = ReturnType<typeof useBuddySession>;
