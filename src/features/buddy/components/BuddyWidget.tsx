import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useBuddy } from "../hooks/useBuddy";
import { BuddyDock, DOCK_EXPAND_S } from "./BuddyDock";
import { BuddyLauncher } from "./BuddyLauncher";

/** Where the full conversation lives. The dock grows into it rather than getting bigger. */
const BUDDY_PAGE = "/buddy";

/**
 * The always-on onboarding companion: the buddy in the corner of every page, and the window it
 * opens.
 *
 * Mounted once at the app root (see `App.tsx`) so it survives navigation and keeps one
 * conversation for the lifetime of the session — which is what "always-on" means, and the
 * reason it is not a per-page component. `useBuddy` warms the visit on mount for the same
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
    activeTool,
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

  // The beat between "open the full page" and the route actually changing, during which the
  // dock is growing to fill the viewport.
  const [isExpanding, setIsExpanding] = useState(false);
  const expandTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (expandTimer.current !== null) window.clearTimeout(expandTimer.current);
    },
    [],
  );

  const goToPage = useCallback(() => {
    // The draft rides along in history state; `useHandedOffDraft` applies it once on the page.
    void navigate(BUDDY_PAGE, { state: { draft } });
  }, [draft, navigate]);

  /**
   * Grows the open dock into the page, then navigates — one gesture instead of a cut.
   *
   * From the launcher (double click, dock closed) there is nothing on screen to grow, so that
   * path just navigates. The timer is what sequences the two: Framer Motion's
   * `onAnimationComplete` fires per-property and would race, and the route change has to happen
   * once, at the end.
   */
  const openFull = useCallback(() => {
    if (!isOpen) {
      goToPage();
      return;
    }

    setIsExpanding(true);
    expandTimer.current = window.setTimeout(() => {
      expandTimer.current = null;
      setIsExpanding(false);
      // Closed on the way out: leaving a floating copy of the conversation over the full-page
      // one is two composers for the same thread.
      toggleOpen();
      goToPage();
    }, DOCK_EXPAND_S * 1000);
  }, [goToPage, isOpen, toggleOpen]);

  if (pathname === BUDDY_PAGE) return null;

  return (
    <>
      {/* Mounted only while open — see `BuddyDock` for why an off-screen fixed panel on every
                page in the app is not a free convenience. `AnimatePresence` is what still lets it
                animate on the way out. */}
      <AnimatePresence>
        {isOpen && (
          <BuddyDock
            key="buddy-dock"
            messages={messages}
            isThinking={isThinking}
            activeTool={activeTool}
            draft={draft}
            setDraft={setDraft}
            handleSubmit={handleSubmit}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            bottomRef={bottomRef}
            suggestions={suggestions}
            onClose={toggleOpen}
            onOpenFull={openFull}
            isExpanding={isExpanding}
          />
        )}
      </AnimatePresence>

      {/* Out of the way while the dock is growing into the page: a button hovering over a
                full-screen expansion is the one thing that would give away that it is still a
                floating window. */}
      {!isExpanding && (
        <BuddyLauncher isOpen={isOpen} onToggle={toggleOpen} onOpenFull={openFull} />
      )}
    </>
  );
}
