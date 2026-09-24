import type { ReactNode } from "react";
import { useToast } from "../../context/useToast";
import { BuddySessionContext } from "./buddySessionContext";
import { useBuddyConversation } from "./hooks/useBuddyConversation";
import { useProjectContext } from "../projects/useProjectContext";

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
 *
 * Team mode is bound to the global project context (the slice handed to the hook below), so the
 * buddy can never disagree with the rest of the app about which project it is discussing. When
 * that binding breaks — management lost, or the selection moved elsewhere while the buddy was
 * mid-conversation — the session drops back to the hire thread and the manager is told why, once,
 * as a toast: a silent fallback is exactly the drift this binding exists to prevent.
 */
export function BuddyProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const {
    selectedProjectId,
    hasSelectedProject,
    canManageSelected,
    isLoading,
    setSelectedProjectId,
  } = useProjectContext();

  const session = useBuddyConversation(
    {
      selectedProjectId,
      hasSelectedProject,
      canManageSelected,
      isLoading,
      setSelectedProjectId,
    },
    () =>
      show(
        "info",
        "Back to your own onboarding — the buddy only discusses a project this page still has selected and you still manage.",
      ),
  );

  return <BuddySessionContext.Provider value={session}>{children}</BuddySessionContext.Provider>;
}
