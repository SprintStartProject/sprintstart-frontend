import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minus, X } from "lucide-react";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { centralSpringToken } from "../../../styles/tokens";
import type { useBuddy } from "../hooks/useBuddy";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyQuestionActions } from "./BuddyQuestionActions";
import { BuddySuggestionChips } from "./BuddySuggestionChips";
import { BuddyThread } from "./BuddyThread";

/** How long the expand-to-page animation runs before the route actually changes, in seconds. */
export const DOCK_EXPAND_S = 0.42;

/** The window's resting size. Big enough to hold a conversation, small enough to leave the page. */
const DOCK_WIDTH = 400;
const DOCK_HEIGHT = 560;

/** Distance from the viewport's right edge, and from the launcher sitting below it. */
const DOCK_RIGHT = 24;
const DOCK_BOTTOM = 104;

type BuddyDockProps = Pick<
  ReturnType<typeof useBuddy>,
  | "messages"
  | "isThinking"
  | "activeTool"
  | "draft"
  | "setDraft"
  | "handleSubmit"
  | "confirmAction"
  | "dismissAction"
  | "bottomRef"
  | "suggestions"
> & {
  onClose: () => void;
  /**
   * Opens the full page, carrying the draft. Omitted when there is nowhere to go — on
   * `/buddy` itself, where the control would offer the page the hire is already reading.
   */
  onOpenFull?: () => void;
  /** Whether the hire has put the suggestion row away for this session. */
  suggestionsHidden?: boolean;
  /** Puts it away. Held by the widget so it survives closing and reopening the dock. */
  onHideSuggestions?: () => void;
  /**
   * True once the hire has asked for the full page: the window grows to fill the viewport and
   * the caller navigates when it lands.
   */
  isExpanding?: boolean;
};

/**
 * The buddy's own little window, in the bottom-right corner over whatever page you are on.
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
export function BuddyDock({
  messages,
  isThinking,
  activeTool,
  draft,
  setDraft,
  handleSubmit,
  confirmAction,
  dismissAction,
  bottomRef,
  suggestions,
  onClose,
  onOpenFull,
  suggestionsHidden = false,
  onHideSuggestions,
  isExpanding = false,
}: BuddyDockProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes it, the way every other dismissible surface in the app behaves. Bound to the
  // document rather than the panel so it works while the hire is reading the page behind it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The composer is what somebody opened this for, so the caret starts there.
  useEffect(() => {
    const field = panelRef.current?.querySelector("textarea");
    field?.focus();
  }, []);

  const hasUserMessage = messages.some((message) => message.role === "USER");

  const resting = {
    width: DOCK_WIDTH,
    height: DOCK_HEIGHT,
    right: DOCK_RIGHT,
    bottom: DOCK_BOTTOM,
    borderRadius: 20,
  };

  // Read here rather than kept in state: the viewport size matters for exactly one animation
  // target, on the render where `isExpanding` flips. A resize listener would be a subscription
  // held for the life of the widget to serve a value used once — and Framer Motion cannot
  // interpolate `400px` to `100vw`, so the target has to be in pixels either way.
  const box =
    isExpanding && typeof window !== "undefined"
      ? {
          width: window.innerWidth,
          height: window.innerHeight,
          right: 0,
          bottom: 0,
          borderRadius: 0,
        }
      : resting;

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label="Onboarding buddy"
      initial={
        prefersReducedMotion
          ? { opacity: 0, ...resting }
          : { opacity: 0, scale: 0.86, y: 24, ...resting }
      }
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        ...box,
      }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 16 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : isExpanding
            ? { duration: DOCK_EXPAND_S, ease: [0.32, 0.72, 0, 1] }
            : centralSpringToken
      }
      // The corner it grows out of, so opening reads as the buddy standing up rather than as a
      // box fading in over the page.
      style={{ transformOrigin: "bottom right" }}
      // The caps keep the window inside a small viewport at rest; while it is growing into the
      // page they would stop it a rem short of the edges, which is exactly where the illusion
      // that it *became* the page would break.
      className={`fixed z-50 flex flex-col overflow-hidden border border-app-border bg-app-bg shadow-2xl ${
        isExpanding ? "" : "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]"
      }`}
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

          {/* The answer to "this is too small" is the page that already exists, rather than a
                    resizable window: `/buddy` renders the same conversation through the same
                    components with room to spare. The draft goes with it — a control that
                    discarded what somebody was typing would be worse than not offering one. */}
          {onOpenFull && (
            <button
              type="button"
              onClick={onOpenFull}
              aria-label="Open the full buddy page"
              title="Open the full page"
              className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Minimise your buddy"
            title="Minimise"
            className="rounded-lg p-1.5 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div
          data-testid="buddy-dock-transcript"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
        >
          <BuddyThread
            messages={messages}
            isThinking={isThinking}
            activeTool={activeTool}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            renderQuestionAction={(question) => <BuddyQuestionActions question={question} />}
          />
          <div ref={bottomRef} />
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
                    <button
                      type="button"
                      onClick={onHideSuggestions}
                      aria-label="Hide suggestions"
                      title="Hide suggestions"
                      className="-mr-1 rounded p-1 text-app-text-disabled transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )
                }
              />
            </div>
          )}

          <BuddyComposer draft={draft} setDraft={setDraft} handleSubmit={handleSubmit} compact />
        </div>
      </motion.div>
    </motion.div>
  );
}
