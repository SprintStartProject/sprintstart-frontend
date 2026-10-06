import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { centralSpringToken } from "../../../styles/tokens";
import {
  LAUNCHER_SIZE,
  isLeftCorner,
  isTopCorner,
  launcherPosition,
  nearestCorner,
  readCorner,
  readViewport,
  useViewportSize,
  writeCorner,
  type BuddyCorner,
} from "../buddyCorner";
import { onBuddyPageReady } from "../aiBuddyBus";
import { BUDDY_PAGE_PATH as BUDDY_PAGE, isBuddyPagePath } from "../buddyPagePath";
import { useBuddy } from "../hooks/useBuddy";
import { useGreetingReveal } from "../hooks/useGreetingReveal";
import { useProjectContext } from "../../projects/useProjectContext";
import { CitationPopover } from "../citations/CitationPopover";
import { citationDrawerProjectId } from "../citations/citationArtifact";
import { useCitationViewer } from "../citations/useCitationViewer";
import { ArtifactViewerDrawer } from "../../knowledge-base/components/ArtifactViewerDrawer";
import { BuddyModeSwitcher } from "./BuddyModeSwitcher";
import { BuddyDock, DOCK_EXPAND_S, DOCK_REVEAL_S } from "./BuddyDock";
import { BuddyLauncher } from "./BuddyLauncher";

/** How long to wait for `/buddy` to announce itself before uncovering it anyway, in ms. */
const HANDOFF_FALLBACK_MS = 1200;

/**
 * The always-on onboarding companion: the buddy in the corner of every page, and the window it
 * opens.
 *
 * Mounted once at the app root (see `App.tsx`) so it survives navigation and keeps one
 * conversation for the lifetime of the session — which is what "always-on" means, and the
 * reason it is not a per-page component. `useBuddy` warms the conversation on mount for the same
 * reason: writing a greeting is the slow part of meeting the buddy, and doing it before the
 * click turns the click into the replay path.
 *
 * Hidden on `/buddy` itself. The launcher is an affordance for reaching the buddy from
 * somewhere else; on its own page it would offer what is already filling the screen, and the
 * dock would put a second composer over the first one for the same thread.
 *
 * The widget owns the navigation, so the launcher and the dock stay presentational components
 * handed callbacks — which is also what keeps them testable without a router.
 *
 * It also owns *where* the buddy sits. The hire can drag the launcher to any of the four corners
 * and the dock goes with it: both share one drag offset while the pointer is down, and on release
 * the offset springs back to zero while both boxes spring to the new corner, so the two motions
 * add up to one continuous glide. The corner is remembered in `localStorage`.
 */
export function BuddyWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The artifact drawer the dock's citations open needs a project to fetch the source within —
  // the conversation's own where it has one (see `citationProjectId`), the same gate the chat
  // applies to its own drawer.
  const { selectedProjectId } = useProjectContext();
  // The dock's citation popover + artifact drawer, held here (not in the dock) for the same
  // reason the widget owns every other piece of surface state: the dock unmounts on close.
  const citationViewer = useCitationViewer();
  const {
    messages,
    sessions,
    currentSessionId,
    isThinking,
    isStreaming,
    stopStreaming,
    queued,
    queuePaused,
    removeQueued,
    pullQueuedMessage,
    resumeQueue,
    filters,
    setFilters,
    capabilitiesEnabled,
    setCapabilitiesEnabled,
    isOpening,
    activeTool,
    openerAction,
    sendMessage,
    presentedGreetingId,
    markGreetingPresented,
    isOpen,
    toggleOpen,
    confirmAction,
    dismissAction,
    actionDrafts,
    setActionDraft,
    suggestions,
    dinoGameActive,
    closeDinoGame,
    registerDinoSurface,
    openError,
    retryOpen,
    closeDock,
    newConversation,
    teamProjectId,
    switchTeamProject,
    isGreeting,
    isDeciding,
  } = useBuddy();

  // The drawer's content read is project-scoped: open citations in the conversation's own
  // project, not the globally selected one — the hire may have switched since it started.
  const citationSession = sessions.find((session) => session.id === currentSessionId);
  const citationProjectId = citationDrawerProjectId(
    citationSession?.projectId,
    teamProjectId,
    selectedProjectId,
  );

  // The switcher (and the composer, and everything else) waits: a turn in flight cannot be
  // called back into a thread that a switch would clear. Same rule as the new-conversation
  // control.
  // `isGreeting` closes the hole where the first token had already released `isOpening` while
  // the greeting was still streaming.
  const isTurnInFlight = isThinking || isStreaming || isOpening || isGreeting || isDeciding;

  // The greeting is usually written before the dock is ever opened; this is what still lets the
  // hire watch the buddy think and write it — see the hook.
  const greeting = useGreetingReveal({
    messages,
    active: isOpen,
    presentedGreetingId,
    markGreetingPresented,
  });

  const prefersReducedMotion = useReducedMotion();
  const viewport = useViewportSize();
  const [corner, setCorner] = useState<BuddyCorner>(readCorner);
  // The corner the launcher would land in if it were let go now; `null` when nothing is dragged.
  const [dropTarget, setDropTarget] = useState<BuddyCorner | null>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const moveTo = useCallback((next: BuddyCorner) => {
    setCorner(next);
    writeCorner(next);
  }, []);

  /** The corner nearest the launcher's centre, drag offset included. */
  const cornerUnderLauncher = useCallback(() => {
    const current = readViewport();
    const { left, top } = launcherPosition(corner, current);
    return nearestCorner(
      left + LAUNCHER_SIZE / 2 + dragX.get(),
      top + LAUNCHER_SIZE / 2 + dragY.get(),
      current,
    );
  }, [corner, dragX, dragY]);

  const handleDrag = useCallback(() => {
    const target = cornerUnderLauncher();
    setDropTarget((previous) => (previous === target ? previous : target));
  }, [cornerUnderLauncher]);

  const handleDragRelease = useCallback(() => {
    moveTo(cornerUnderLauncher());
    setDropTarget(null);
    // Back to zero while the boxes spring to the new corner — see the comment on the component.
    const transition = prefersReducedMotion ? { duration: 0 } : centralSpringToken;
    void animate(dragX, 0, transition);
    void animate(dragY, 0, transition);
  }, [cornerUnderLauncher, dragX, dragY, moveTo, prefersReducedMotion]);

  // The keyboard's way to do the same: `Alt` + an arrow moves to the corner on that side.
  const handleMoveCorner = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      const top = direction === "up" || (direction !== "down" && isTopCorner(corner));
      const left = direction === "left" || (direction !== "right" && isLeftCorner(corner));
      moveTo(`${top ? "top" : "bottom"}-${left ? "left" : "right"}`);
    },
    [corner, moveTo],
  );

  /**
   * Where the hand-off to `/buddy` has got to.
   *
   * `growing` — the window is swelling to cover the viewport; the route has not changed.
   * `covering` — it covers everything and the route change is under way behind it. It holds
   *   here, fully opaque, for as long as that takes.
   * `revealing` — the page has said it is on screen, so the window fades away and uncovers it.
   *
   * The middle phase is not decoration. Navigating too early flashes the buddy page into view
   * around a small window; unmounting at the end of the growth leaves a frame with nothing on
   * top. And the wait cannot be a fixed delay: React Router wraps navigation in
   * `React.startTransition`, so React keeps the *previous* page on screen until the new one is
   * ready to commit — a clock-driven reveal uncovered the page the hire was leaving. The page
   * itself says when it has arrived (`onBuddyPageReady`).
   */
  const [handoff, setHandoff] = useState<"idle" | "growing" | "covering" | "revealing">("idle");
  // Held here rather than in the dock, which unmounts every time it is closed — a row the hire
  // has already dismissed coming back on the next open is the dismissal not working.
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  /**
   * The hand-off's pending timers, each held by name so it can be cancelled precisely.
   *
   * A bag of ids that was only emptied on unmount is what let the fallback below outlive the
   * hand-off it belonged to: the page announced itself, the sequence finished, and 1.2s later a
   * timer nobody had cancelled pushed the phase back to `revealing` and toggled the dock open
   * again. An app-root component never unmounts, so "cleared on unmount" is never.
   */
  const growTimer = useRef<number | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const clearHandoffTimers = useCallback(() => {
    [growTimer, fallbackTimer, revealTimer].forEach((timer) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    });
  }, []);

  useEffect(() => clearHandoffTimers, [clearHandoffTimers]);

  /**
   * Hands the conversation over to `/buddy`.
   *
   * Nothing has to ride along with it: the composer lives in `BuddyDraftProvider`, which sits above
   * the router, so the page's box already holds the words this window holds — the hand-off is the
   * same conversation on a wider surface, not a transfer. Carrying a copy through history state was
   * a second mechanism for that, and it was what made this callback depend on the draft: every
   * keystroke rebuilt `goToPage`, then `openFull`, then the dock.
   */
  const goToPage = useCallback(() => {
    // The conversation on screen is the one the page should open — the hand-off lands on the
    // thread the hire was reading, not on whichever conversation the page happens to resolve
    // as newest. A dock that has not opened a conversation yet has nothing to name and falls
    // back to the plain route; the page resolves it the way it always did.
    void navigate(currentSessionId ? `${BUDDY_PAGE}/${currentSessionId}` : BUDDY_PAGE);
  }, [navigate, currentSessionId]);

  /**
   * The props the dock's memoised thread compares, each held in one identity.
   *
   * The thread — and every row in it — is memoised, which is what keeps a keystroke and every
   * streamed token out of the conversation's re-render path (issue #236). Any of these built
   * inline here would hand it a new prop on every render of the widget and put them all back.
   */
  const hasUserMessage = messages.some((message) => message.role === "USER");
  // The greeting's one suggested next step, which only `/buddy` used to offer.
  const lastMessageFooter = useMemo(
    () =>
      openerAction && !greeting.isRevealing && !hasUserMessage ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-1.5"
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => void sendMessage(openerAction.question)}
        >
          {openerAction.label}
        </Button>
      ) : undefined,
    [openerAction, greeting.isRevealing, hasUserMessage, sendMessage],
  );
  const retryOpenAction = useCallback(() => void retryOpen(), [retryOpen]);
  const hideSuggestions = useCallback(() => setSuggestionsHidden(true), []);

  /**
   * The dock's header control, held in one identity for the same reason as the props above: the
   * dock is memoised, and a switcher built inline here would be a fresh element on every render of
   * the widget — a prop the memo would compare and always find changed.
   */
  const headerControl = useMemo(
    () => (
      <BuddyModeSwitcher
        teamProjectId={teamProjectId}
        onSwitch={(projectId) => void switchTeamProject(projectId)}
        disabled={isTurnInFlight}
      />
    ),
    [teamProjectId, switchTeamProject, isTurnInFlight],
  );

  /**
   * Grows the open dock into the page — one gesture instead of a cut.
   *
   * From the launcher (double click, dock closed) there is nothing on screen to grow, so that
   * path just navigates. Timers sequence the phases rather than Framer Motion's
   * `onAnimationComplete`, which fires once per animated property and would race itself.
   */
  const openFull = useCallback(() => {
    if (!isOpen) {
      goToPage();
      return;
    }

    clearHandoffTimers();
    setHandoff("growing");

    growTimer.current = window.setTimeout(() => {
      growTimer.current = null;
      // The window covers the viewport by now, so the route can change behind it unseen.
      goToPage();
      setHandoff("covering");

      // Only if the page never announces itself — a render error, or a route that did not
      // resolve. Better a hand-off that finishes a beat late than a window stuck over the
      // whole app with no way out. Guarded on the phase like every other transition here, so
      // a stray firing can never restart a sequence that has already finished.
      fallbackTimer.current = window.setTimeout(() => {
        fallbackTimer.current = null;
        setHandoff((phase) => (phase === "covering" ? "revealing" : phase));
      }, HANDOFF_FALLBACK_MS);
    }, DOCK_EXPAND_S * 1000);
  }, [clearHandoffTimers, goToPage, isOpen]);

  // The page is on screen: stop standing in for it, and drop the fallback that was only there
  // in case this never came.
  useEffect(
    () =>
      onBuddyPageReady(() => {
        if (fallbackTimer.current !== null) {
          window.clearTimeout(fallbackTimer.current);
          fallbackTimer.current = null;
        }
        setHandoff((phase) => (phase === "covering" ? "revealing" : phase));
      }),
    [],
  );

  // ...and once it has faded away, put the dock itself away. Leaving it open would be a second
  // composer floating over the full-page one, for the same thread.
  useEffect(() => {
    if (handoff !== "revealing") return;

    revealTimer.current = window.setTimeout(
      () => {
        revealTimer.current = null;
        setHandoff("idle");
        // `closeDock`, never `toggleOpen`: by this point the dock may already have been closed
        // — Escape closes it, and it can be closed during the growth — and a toggle would then
        // open it again behind the page.
        closeDock();
      },
      (DOCK_REVEAL_S + 0.05) * 1000,
    );

    return () => {
      if (revealTimer.current === null) return;
      window.clearTimeout(revealTimer.current);
      revealTimer.current = null;
    };
  }, [handoff, closeDock]);

  // The dock is a surface the dino game may live in only while it is actually on screen:
  // minimised, or hidden behind `/buddy`, a Space press must not open a game nobody can see.
  const dockVisible = isOpen && !(isBuddyPagePath(pathname) && handoff === "idle");
  useEffect(() => {
    if (!dockVisible) return;
    return registerDinoSurface();
  }, [dockVisible, registerDinoSurface]);

  // Normally the widget takes itself off the buddy page — the launcher would offer the page you
  // are reading, and the dock would put a second composer over the first. During the hand-off it
  // has to stay: it *is* the transition, and unmounting it the instant the route changes is
  // precisely the flash this sequencing exists to remove. The per-conversation addresses
  // (`/buddy/:id`) are just as much "the page" — see `isBuddyPagePath`.
  if (isBuddyPagePath(pathname) && handoff === "idle") return null;

  return (
    <>
      {/* Mounted only while open — see `BuddyDock` for why an off-screen fixed panel on every
                page in the app is not a free convenience. `AnimatePresence` is what still lets it
                animate on the way out. */}
      <AnimatePresence>
        {isOpen && (
          <BuddyDock
            key="buddy-dock"
            corner={corner}
            dragX={dragX}
            dragY={dragY}
            messages={greeting.messages}
            // `isOpening` too, the way `/buddy` passes it: a dock opened while the greeting is
            // still being written showed an empty window instead of the buddy typing.
            isThinking={isThinking || isOpening || greeting.isThinking}
            // Held in one identity above, with the reason written there — the thread's memo
            // compares it.
            lastMessageFooter={lastMessageFooter}
            isStreaming={isStreaming}
            stopStreaming={stopStreaming}
            queued={queued}
            queuePaused={queuePaused}
            removeQueued={removeQueued}
            pullQueuedMessage={pullQueuedMessage}
            resumeQueue={resumeQueue}
            filters={filters}
            setFilters={setFilters}
            capabilitiesEnabled={capabilitiesEnabled}
            setCapabilitiesEnabled={setCapabilitiesEnabled}
            activeTool={activeTool}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            actionDrafts={actionDrafts}
            setActionDraft={setActionDraft}
            suggestions={suggestions}
            dinoGameActive={dinoGameActive}
            onDinoGameExit={closeDinoGame}
            newConversation={newConversation}
            isOpening={isOpening}
            isGreeting={isGreeting}
            isDeciding={isDeciding}
            teamProjectId={teamProjectId}
            openError={openError}
            onRetryOpen={retryOpenAction}
            // Citation interaction for this surface: a `[N]` click opens the popover, and the
            // footer's "Open source" hands the artifact to the drawer — both rendered below.
            // No project to open a drawer in: pass no artifact opener, so the popover (and the
            // footer's chips) fall back to the external source link instead of dead-ending.
            onCitationClick={citationViewer.handleCitationClick}
            onOpenArtifact={citationProjectId ? citationViewer.handleOpenArtifact : undefined}
            onClose={toggleOpen}
            onOpenFull={openFull}
            suggestionsHidden={suggestionsHidden}
            onHideSuggestions={hideSuggestions}
            // Hire conversation ↔ team conversations, in the header beside the title. The
            // switcher only *offers* the switch; the restore audit lives in the session
            // (`useBuddyConversation` / `BuddyProvider`). Memoised above, like the props around
            // it: the dock is a memoised component now.
            headerControl={headerControl}
            isExpanding={handoff !== "idle"}
            isRevealing={handoff === "revealing"}
          />
        )}
      </AnimatePresence>

      {/* Out of the way while the dock is growing into the page: a button hovering over a
                full-screen expansion is the one thing that would give away that it is still a
                floating window. */}
      {/* Where it can go, while it is being dragged: a quiet ring in each corner, and the one it
                would land in filled. Decorative — the drop works the same without them. */}
      <AnimatePresence>
        {dropTarget !== null &&
          (["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((target) => (
            <motion.span
              key={target}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: target === dropTarget ? 1.08 : 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={prefersReducedMotion ? { duration: 0 } : centralSpringToken}
              style={launcherPosition(target, viewport)}
              className={`pointer-events-none fixed z-30 size-16 rounded-full border-2 border-dashed transition-colors ${
                target === dropTarget
                  ? "border-app-brand bg-app-brand-soft"
                  : "border-app-border-strong bg-app-surface/40"
              }`}
            />
          ))}
      </AnimatePresence>

      {handoff === "idle" && (
        <BuddyLauncher
          isOpen={isOpen}
          onToggle={toggleOpen}
          onOpenFull={openFull}
          corner={corner}
          dragX={dragX}
          dragY={dragY}
          onDragStart={handleDrag}
          onDrag={handleDrag}
          onDragRelease={handleDragRelease}
          onMoveCorner={handleMoveCorner}
        />
      )}

      {/* The citation popover and the artifact drawer, once a reply's sources are clicked. Kept
          out of the dock's own tree so the fixed overlays are not clipped by its scroll
          container, and rendered after it in the DOM so they sit above the window (both are
          `z-50`). The widget is off `/buddy`, where the page renders its own pair — the two
          never share a screen. */}
      {citationViewer.selectedCitation && (
        <CitationPopover
          selected={citationViewer.selectedCitation}
          onClose={citationViewer.closeCitation}
          onOpenArtifact={citationProjectId ? citationViewer.handleOpenArtifact : undefined}
        />
      )}

      {citationViewer.citationArtifact && citationProjectId && (
        <ArtifactViewerDrawer
          artifact={citationViewer.citationArtifact}
          onClose={citationViewer.closeArtifact}
          projectId={citationProjectId}
          highlightLines={citationViewer.highlightLines}
          canDelete={false}
          onDelete={() => {}}
        />
      )}
    </>
  );
}
