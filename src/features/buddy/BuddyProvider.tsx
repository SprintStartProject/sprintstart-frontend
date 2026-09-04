import type { ReactNode } from "react";
import { BuddySessionContext } from "./buddySessionContext";
import { useBuddyConversation } from "./hooks/useBuddyConversation";

/**
 * Holds the hire's one buddy conversation for the lifetime of the session.
 *
 * The dock and the `/buddy` page used to run `useBuddyConversation` each, which made them two
 * conversations wearing one name: the dock kept the messages it had loaded, the page opened a
 * *fresh visit* on every mount, and a hire who asked something in the corner window and then
 * clicked through to the full page found their question gone. Worse, the page's open rotated
 * the visit server-side, so the context really was thrown away rather than merely hidden.
 *
 * One instance, mounted above both, is what makes "your buddy" a true statement. Neither
 * surface owns the conversation now; they are two views of it, and a message sent in either
 * appears in the other because there is only one list.
 *
 * It costs nothing until something asks for it: the state is created on mount, but no request
 * is made until a surface calls `ensureOpened` — the dock when it is first opened, the page when
 * it mounts.
 */
export function BuddyProvider({ children }: { children: ReactNode }) {
  const session = useBuddyConversation();

  return <BuddySessionContext.Provider value={session}>{children}</BuddySessionContext.Provider>;
}
