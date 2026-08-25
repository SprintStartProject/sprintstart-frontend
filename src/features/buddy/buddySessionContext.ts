import { createContext, useContext } from "react";
import type { useBuddyConversation } from "./hooks/useBuddyConversation";

/** Everything one buddy conversation is: its messages, its composer, and its send loop. */
export type BuddySession = ReturnType<typeof useBuddyConversation>;

export const BuddySessionContext = createContext<BuddySession | null>(null);

/**
 * The one buddy conversation this session has.
 *
 * There is deliberately no fallback for a missing provider. A hook that quietly made its own
 * conversation would reintroduce the exact bug this context exists to fix: the dock and the page
 * each holding their own copy, showing different messages for what the hire is told is one
 * buddy. Failing loudly at the boundary is the point — see `BuddyProvider`.
 */
export function useBuddySession(): BuddySession {
  const session = useContext(BuddySessionContext);

  if (!session) {
    throw new Error("useBuddySession must be used inside a BuddyProvider");
  }

  return session;
}
