import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBuddy } from "../hooks/useBuddy";
import { BuddyDock } from "./BuddyDock";
import { BuddyLauncher } from "./BuddyLauncher";

/** Where the full conversation lives. The dock hands off to it rather than growing. */
const BUDDY_PAGE = "/buddy";

/**
 * The always-on, repo-grounded onboarding companion: the buddy in the corner of every page,
 * and the dock it opens.
 *
 * Mounted once at the app root (see `App.tsx`) so it survives navigation and keeps one
 * conversation for the lifetime of the session — which is the point of an always-on buddy, and
 * the reason it is not a per-page component. `useBuddy` warms the visit on mount for the same
 * reason: writing a greeting is the slow part of meeting the buddy, and doing it before the
 * click turns the click into the replay path.
 *
 * Hidden on `/buddy` itself. The launcher is an affordance for reaching the buddy from
 * somewhere else; on its own page it would offer what is already filling the screen, and the
 * dock would put a second composer over the first one for the same thread.
 *
 * The widget owns the navigation, so the launcher and the dock stay presentational components
 * handed callbacks — which is also what keeps them testable without a router.
 */
export function BuddyWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    messages,
    isThinking,
    isOpen,
    toggleOpen,
    draft,
    setDraft,
    handleSubmit,
    confirmAction,
    dismissAction,
    bottomRef,
    suggestions,
  } = useBuddy();

  const isOnBuddyPage = pathname === BUDDY_PAGE;

  const openFull = useCallback(() => {
    // The draft rides along in history state; `useHandedOffDraft` applies it once on the page.
    void navigate(BUDDY_PAGE, { state: { draft } });
    // Closed on the way out: leaving a floating copy of the conversation over the full-page
    // one is two composers for the same thread.
    if (isOpen) toggleOpen();
  }, [draft, isOpen, navigate, toggleOpen]);

  if (isOnBuddyPage) return null;

  return (
    <>
      <BuddyDock
        messages={messages}
        isThinking={isThinking}
        draft={draft}
        setDraft={setDraft}
        handleSubmit={handleSubmit}
        confirmAction={confirmAction}
        dismissAction={dismissAction}
        bottomRef={bottomRef}
        suggestions={suggestions}
        isOpen={isOpen}
        onClose={toggleOpen}
        onOpenFull={openFull}
      />

      <BuddyLauncher isOpen={isOpen} onToggle={toggleOpen} onOpenFull={openFull} />
    </>
  );
}
