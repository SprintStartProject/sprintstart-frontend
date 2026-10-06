import { memo, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion, useReducedMotion, type MotionValue } from "framer-motion";
import { Maximize2, MessageSquarePlus, Minus, X } from "lucide-react";
import { SleepyBot } from "./SleepyBot";
import { Button } from "../../../components/ui/Button";
import { centralSpringToken } from "../../../styles/tokens";
import type { useBuddy } from "../hooks/useBuddy";
import { useBuddyDraftActions } from "../buddyDraftContext";
import type { BuddyMessageView } from "../types";
import type { SelectedCitation } from "../citations/types";
import type { CitationArtifactOpen } from "../citations/citationArtifact";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyQuestionActions } from "./BuddyQuestionActions";
import { BuddySuggestionChips } from "./BuddySuggestionChips";
import { BuddyThread } from "./BuddyThread";
import { BuddyReplyActions } from "./BuddyReplyActions";
import { useStickToBottom } from "../hooks/useStickToBottom";
import {
  DEFAULT_CORNER,
  cornerTransformOrigin,
  dockBox,
  isTopCorner,
  useViewportSize,
  type BuddyCorner,
} from "../buddyCorner";

/**
 * The hand-off to `/buddy`, in seconds, in two parts.
 *
 * `DOCK_EXPAND_S` is the growth: the window swells until it covers the viewport. Only *then* is
 * it safe to change the route, because the window is what the hire is looking at.
 *
 * `DOCK_REVEAL_S` is the uncovering, once the page beneath has rendered. Splitting the two is
 * what removes the flash of the old page that used to sit between them — the dock used to
 * unmount and navigate at the same instant, so for a frame there was nothing on top and the
 * page you were leaving showed through.
 */
export const DOCK_EXPAND_S = 0.42;
export const DOCK_REVEAL_S = 0.2;

type BuddyDockProps = Pick<
  ReturnType<typeof useBuddy>,
  | "messages"
  | "isThinking"
  | "isStreaming"
  | "stopStreaming"
  | "queued"
  | "queuePaused"
  | "removeQueued"
  | "pullQueuedMessage"
  | "resumeQueue"
  | "filters"
  | "setFilters"
  | "capabilitiesEnabled"
  | "setCapabilitiesEnabled"
  | "activeTool"
  | "confirmAction"
  | "dismissAction"
  | "actionDrafts"
  | "setActionDraft"
  | "suggestions"
  | "newConversation"
  | "isOpening"
  | "isGreeting"
  | "isDeciding"
  | "teamProjectId"
> & {
  onClose: () => void;
  /** Rendered under the buddy's most recent reply — the greeting's suggested next step. */
  lastMessageFooter?: ReactNode;
  /** The corner the launcher sits in; the window opens beside it. */
  corner?: BuddyCorner;
  /**
   * The launcher's drag offset. The window rides along on it while the launcher is dragged, and
   * settles with it once it is dropped.
   */
  dragX?: MotionValue<number>;
  dragY?: MotionValue<number>;
  /**
   * Opens the full page, carrying the draft. Omitted when there is nowhere to go — on
   * `/buddy` itself, where the control would offer the page the hire is already reading.
   */
  onOpenFull?: () => void;
  /**
   * Why the conversation could not be brought on screen at all — see `BuddyThread`. Handed in
   * rather than picked off the session, like every other callback here: the dock stays a
   * presentational component the widget drives, which is what keeps it testable without one.
   */
  openError?: string | null;
  /** Tries the read again, from the banner that reports the failure. */
  onRetryOpen?: () => void;
  /** Whether the dino waiting-game is open while the buddy thinks (see `BuddyThread`). */
  dinoGameActive?: boolean;
  /**
   * Called when the hire clicks a `[N]` citation reference in a reply.
   *
   * Held in one identity by the widget, like the callbacks above — the thread's memo compares it.
   */
  onCitationClick?: (citation: SelectedCitation) => void;
  /** Opens the artifact drawer from a reply's citations footer — see `BuddyThread`. */
  onOpenArtifact?: (data: CitationArtifactOpen) => void;
  /**
   * Called when the player leaves the dino waiting-game. Named `onDinoGameExit` to match
   * BuddyThread, which is what the dock forwards it to — one name across the dock → thread
   * boundary so callers pass it once and forget.
   */
  onDinoGameExit?: () => void;
  /** Whether the hire has put the suggestion row away for this session. */
  suggestionsHidden?: boolean;
  /** Puts it away. Held by the widget so it survives closing and reopening the dock. */
  onHideSuggestions?: () => void;
  /**
   * True once the hire has asked for the full page: the window grows to fill the viewport and
   * holds there, covering everything, while the caller changes the route behind it.
   */
  isExpanding?: boolean;
  /**
   * True for the last beat of the hand-off: the page underneath has rendered, so the window
   * that has been standing in for it fades away and reveals it.
   */
  isRevealing?: boolean;
  /**
   * A control rendered in the header beside the title — the conversation switcher. Handed in
   * like every other prop so the dock stays presentational (and testable without a project
   * context to read).
   */
  headerControl?: ReactNode;
};

/**
 * The buddy's own little window, in the corner of whatever page you are on — beside the launcher,
 * in whichever of the four corners the hire has dragged it to.
 *
 * **Small on purpose.** It is the size of a conversation, not the size of the app: the buddy is
 * consulted *about* what you are looking at, so a full-height drawer that covered the page hid
 * the very thing the question was about. This one leaves the page where it is — no dimming, no
 * overlay, nothing to dismiss before you can carry on reading.
 *
 * It is only mounted while it is open. That matters beyond tidiness: kept mounted and parked
 * off-screen, a fixed panel is still a fixed panel on every page in the app, and the layout
 * effects of that are exactly the kind nobody connects back to the buddy.
 *
 * Not a modal, and deliberately not `ui/SidePanel`, which is one: there is no backdrop, the
 * page behind stays interactive, and trapping focus in a window somebody is meant to consult
 * *while* working would fight that. `role="dialog"` without `aria-modal` is the honest
 * description — a named region you can leave.
 *
 * Growing into the page is one gesture, not a cut: `isExpanding` animates the window out to
 * the full viewport, and the caller changes the route as it lands. Without that the dock
 * vanished and a page appeared, and nobody could tell it was the same conversation.
 */
function BuddyDockImpl({
  messages,
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
  activeTool,
  confirmAction,
  dismissAction,
  actionDrafts,
  setActionDraft,
  suggestions,
  dinoGameActive = false,
  onDinoGameExit,
  onCitationClick,
  onOpenArtifact,
  newConversation,
  isOpening,
  isGreeting,
  isDeciding,
  teamProjectId,
  openError,
  onClose,
  lastMessageFooter,
  corner = DEFAULT_CORNER,
  dragX,
  dragY,
  onOpenFull,
  onRetryOpen,
  suggestionsHidden = false,
  onHideSuggestions,
  isExpanding = false,
  isRevealing = false,
  headerControl,
}: BuddyDockProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const { containerRef, onScroll } = useStickToBottom(messages);

  // The chips fill the composer through the write-only half, so this window does not follow
  // every character typed into the box — see `useBuddyDraftActions`.
  const { setDraft } = useBuddyDraftActions();

  /**
   * The callbacks `BuddyThread` is handed, each held in one identity.
   *
   * The thread is memoised — that is what keeps a keystroke (or a token) from re-rendering the
   * whole conversation — and a callback built inline here would hand it a new prop on every
   * render of this window, which is exactly the dance the memo exists to avoid.
   */
  const renderReplyAction = useCallback(
    (reply: string, message: BuddyMessageView) => (
      <BuddyReplyActions reply={reply} message={message} />
    ),
    [],
  );
  const renderQuestionAction = useCallback(
    (question: string) =>
      teamProjectId === null ? <BuddyQuestionActions question={question} /> : undefined,
    [teamProjectId],
  );

  // Escape closes it, the way every other dismissible surface in the app behaves. Bound to the
  // document rather than the panel so it works while the hire is reading the page behind it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasUserMessage = messages.some((message) => message.role === "USER");
  // Mid-turn: the buddy is deciding, running a tool, or writing. Not a spinner's worth of
  // state -- it gates the one control that would pull the thread out from under a reply
  // that is still arriving.
  const isBusy = isThinking || isStreaming || isGreeting || isDeciding;

  const viewport = useViewportSize();
  const resting = { ...dockBox(corner, viewport), borderRadius: 20 };

  // The viewport in pixels rather than `100vw`: Framer Motion cannot interpolate `400px` to
  // `100vw`, so the growth target has to be the same unit as the resting box.
  const box = isExpanding
    ? { left: 0, top: 0, width: viewport.width, height: viewport.height, borderRadius: 0 }
    : resting;

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label="Onboarding buddy"
      initial={
        prefersReducedMotion
          ? { opacity: 0, ...resting }
          : {
              opacity: 0,
              scale: 0.86,
              ...resting,
              // Rises out of a launcher below it, drops out of one above it. `top` rather than
              // `y`, because `y` is the drag offset it shares with the launcher.
              top: resting.top + (isTopCorner(corner) ? -24 : 24),
            }
      }
      animate={{
        opacity: isRevealing ? 0 : 1,
        scale: 1,
        ...box,
      }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : isRevealing
            ? // A beat of delay before the fade: the route has only just changed, and starting
              // to uncover the page in the same frame it mounts shows it mid-paint.
              { duration: DOCK_REVEAL_S, ease: "easeOut", delay: 0.05 }
            : isExpanding
              ? { duration: DOCK_EXPAND_S, ease: [0.32, 0.72, 0, 1] }
              : centralSpringToken
      }
      style={{
        // The corner it grows out of, so opening reads as the buddy standing up rather than as
        // a box fading in over the page.
        transformOrigin: cornerTransformOrigin(corner),
        x: dragX,
        y: dragY,
      }}
      // No `max-h`/`max-w` caps any more: `dockBox` already fits the window inside the viewport,
      // with its header on screen, and caps would stop the growth into the page short of the edges.
      className="fixed z-50 flex flex-col overflow-hidden border border-app-border bg-app-bg shadow-2xl"
    >
      {/* Everything inside fades as the window grows, so by the time the route changes the
                screen holds nothing but a full-bleed `bg-app-bg` surface — which is exactly what
                the page arrives on. Growing the window while its contents stayed put put a
                dock-sized header and a 400px composer across a full screen for a beat, and then
                cut; this is what removes the cut rather than merely shortening it. */}
      <motion.div
        animate={{ opacity: isExpanding ? 0 : 1 }}
        transition={{ duration: isExpanding ? DOCK_EXPAND_S * 0.45 : 0.2, ease: "easeOut" }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-app-border bg-app-surface px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-app-brand-soft">
            <SleepyBot size={26} canSleep={false} className="text-app-brand-text" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app-text">Buddy</p>
            <p className="truncate text-xs text-app-text-muted">Your onboarding mentor</p>
          </div>

          {/* Hire conversation ↔ team conversations. Rendered by the caller (the widget), like
                    every other session-driven piece here, so the dock needs no project context
                    of its own. `max-w-full min-w-0` keeps a long project name from pushing the
                    new-conversation control out of a 384 px window. */}
          {headerControl && <div className="max-w-[11rem] min-w-0 shrink-0">{headerControl}</div>}

          {/* Same control, same words and the same promise as the one on `/buddy`: the window is
                    a view of that conversation, so anything it can do to the conversation it has to
                    be able to do here — a hire who had to open the full page to start over would
                    reasonably conclude the two were different buddies. Offered only once there is
                    something to leave behind; on an untouched conversation it would create a
                    second empty one the hire did not ask for.

                    The hire's surface only — team mode has one conversation per project and
                    nothing to start.

                    Withdrawn while a turn is in flight, and while a conversation is opening:
                    a new conversation clears the thread, but the click cannot call back the
                    request already streaming into it — that stream's callbacks still hold the
                    shared conversation, so its tool events would land in the new one
                    ("Checking your progress…" beneath an empty thread) — and an open's read is
                    on its way into the very thread this click would clear. Offering the control
                    only between turns is the cheap half of that fix; aborting the stream is the
                    other half and belongs in the session, alongside the same gap on `BuddyPage`. */}
          {hasUserMessage && !isBusy && !isOpening && teamProjectId === null && (
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              onClick={() => void newConversation()}
              aria-label="Start a new conversation"
              // No chord named here, deliberately. The window floats over every page, and
              // `Alt+N` belongs to whichever one is underneath it — on `/chat` it starts a new
              // *chat*, and on most pages nothing binds it at all. Advertising it from the dock
              // would be promising a key that does somebody else's job.
              title="Start a new conversation — your buddy keeps what it has learned about you"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {/* The answer to "this is too small" is the page that already exists, rather than a
                    resizable window: `/buddy` renders the same conversation through the same
                    components with room to spare. The draft goes with it — a control that
                    discarded what somebody was typing would be worse than not offering one. */}
          {onOpenFull && (
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              onClick={onOpenFull}
              aria-label="Open the full buddy page"
              title="Open the full page"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            iconOnly
            onClick={onClose}
            aria-label="Minimise your buddy"
            title="Minimise"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div
          ref={containerRef}
          onScroll={onScroll}
          data-testid="buddy-dock-transcript"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
        >
          <BuddyThread
            renderReplyAction={renderReplyAction}
            compact
            messages={messages}
            isThinking={isThinking}
            isStreaming={isStreaming}
            activeTool={activeTool}
            lastMessageFooter={lastMessageFooter}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            actionDrafts={actionDrafts}
            setActionDraft={setActionDraft}
            // Hire-flow only: "Send this to your PM" escalates the hire's own question, and a
            // team-mode conversation is not one — the offer must not even render there.
            renderQuestionAction={renderQuestionAction}
            openError={openError}
            onRetryOpen={onRetryOpen}
            dinoGameActive={dinoGameActive}
            onDinoGameExit={onDinoGameExit}
            onCitationClick={onCitationClick}
            onOpenArtifact={onOpenArtifact}
          />
        </div>

        <div className="shrink-0 border-t border-app-border bg-app-surface px-4 py-3">
          {/* Above the composer, not above the transcript: the chips exist to answer "what do I
                    type here", so they belong next to the box they fill. Gone once the hire has
                    said something — by then they know how, and the window is narrow. */}
          {!hasUserMessage && !suggestionsHidden && (
            <div className="mb-2.5 min-w-0">
              <BuddySuggestionChips
                suggestions={suggestions}
                onPick={setDraft}
                heading="Try asking"
                // The full row took roughly half the window: five chips at reading size wrapped
                // over three lines, leaving the conversation the other half. Compact caps them
                // and shrinks them, and the hire can put the row away entirely.
                compact
                headingAction={
                  onHideSuggestions && (
                    <Button
                      variant="ghost"
                      size="xs"
                      iconOnly
                      onClick={onHideSuggestions}
                      aria-label="Hide suggestions"
                      title="Hide suggestions"
                      className="-my-1.5 -mr-1.5"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )
                }
              />
            </div>
          )}

          {/* The composer is what somebody opened this for, so the caret starts there — and
                        *behind* a seeded draft, which is why this goes through the composer's own
                        `focusOnMount` rather than a bare `focus()`. A focused textarea with a value
                        in it starts the caret at position 0, so "Ask your buddy about this" used to
                        hand over a question the hire then typed in front of. */}
          <BuddyComposer
            compact
            focusOnMount
            busy={isBusy}
            gameActive={dinoGameActive}
            streaming={isStreaming}
            onStop={stopStreaming}
            queue={{
              items: queued,
              paused: queuePaused,
              onRemove: removeQueued,
              onPull: pullQueuedMessage,
              onSendQueued: resumeQueue,
            }}
            filters={filters}
            onFiltersChange={setFilters}
            capabilitiesEnabled={capabilitiesEnabled}
            onCapabilitiesChange={setCapabilitiesEnabled}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Memoised, like `BuddyThread`: every prop on this panel is either a plain value, a callback the
 * widget holds in one identity, or a motion value — so a render of the widget that changes none of
 * them (a resize while the dock is open, a drag across the screen) no longer re-walks the dock's
 * whole layout. `headerControl` is held in one identity at the call site for the same reason.
 */
export const BuddyDock = memo(BuddyDockImpl);
