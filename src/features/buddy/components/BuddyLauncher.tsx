import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion, type MotionValue } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import { centralSpringToken } from "../../../styles/tokens";
import {
  DEFAULT_CORNER,
  isTopCorner,
  launcherPosition,
  useViewportSize,
  type BuddyCorner,
} from "../buddyCorner";

/** How long a first click waits for a second one before it counts as a single click. */
const DOUBLE_CLICK_WINDOW_MS = 220;

type BuddyLauncherProps = {
  /** Whether the dock is open — the launcher turns into its minimise control. */
  isOpen: boolean;
  /** Single click: open or minimise the dock. */
  onToggle: () => void;
  /** Double click: go straight to the full page. */
  onOpenFull: () => void;
  /** The corner it sits in. */
  corner?: BuddyCorner;
  /**
   * The drag offset, owned by the widget so the dock can follow the launcher while it is being
   * dragged and both can settle back together.
   */
  dragX?: MotionValue<number>;
  dragY?: MotionValue<number>;
  /** A drag has started. */
  onDragStart?: () => void;
  /** The launcher moved under the pointer. */
  onDrag?: () => void;
  /** The pointer let go — the widget picks the corner it was dropped nearest. */
  onDragRelease?: () => void;
  /** `Alt` + an arrow key: the keyboard way to the corner on that side. */
  onMoveCorner?: (direction: "up" | "down" | "left" | "right") => void;
};

const ARROWS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
} as const;

/**
 * The buddy itself, parked in the bottom-right corner of every page.
 *
 * It is the character, not an icon of one: the same `SleepyBot` that answers in the thread and
 * dozes off on the dashboard, drawn at launcher size, following the pointer while it is awake.
 * A lucide glyph in a circle would have been a button that opens a chat; this is somebody
 * sitting in the corner of the room, which is the whole idea of an always-on buddy.
 *
 * **One click opens the dock, two open the full page.** Those cannot both fire, so a single
 * click waits out {@link DOUBLE_CLICK_WINDOW_MS} before it commits — long enough to catch the
 * second click, short enough that opening the dock still feels immediate. `onDoubleClick` alone
 * would not do: the browser fires the two `click`s first, so the dock would open and the page
 * would then navigate out from under it.
 *
 * While the dock is open the launcher becomes its minimise control — same spot, same target,
 * so putting the buddy away is where picking it up was.
 *
 * **It can be dragged to any of the four corners**, and the dock goes with it. It is positioned
 * in pixels rather than by `right`/`bottom` classes so a change of corner is a spring rather than
 * a jump; a drag that ends is not a click, so letting go never also opens the dock.
 */
export function BuddyLauncher({
  isOpen,
  onToggle,
  onOpenFull,
  corner = DEFAULT_CORNER,
  dragX,
  dragY,
  onDragStart,
  onDrag,
  onDragRelease,
  onMoveCorner,
}: BuddyLauncherProps) {
  const prefersReducedMotion = useReducedMotion();
  const pendingClick = useRef<number | null>(null);
  // Set while a drag is under way and for the click the browser fires when it ends — a drop is
  // not a press.
  const dragged = useRef(false);
  const viewport = useViewportSize();
  const position = launcherPosition(corner, viewport);

  const clearPending = useCallback(() => {
    if (pendingClick.current === null) return;
    window.clearTimeout(pendingClick.current);
    pendingClick.current = null;
  }, []);

  // A timer that outlives the component would toggle a dock that is no longer mounted.
  useEffect(() => clearPending, [clearPending]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (dragged.current) {
        dragged.current = false;
        return;
      }

      // `detail` is the click count the browser has already counted for this burst, so the
      // second click is recognised without keeping a count of our own.
      if (event.detail > 1) {
        clearPending();
        onOpenFull();
        return;
      }

      clearPending();
      pendingClick.current = window.setTimeout(() => {
        pendingClick.current = null;
        onToggle();
      }, DOUBLE_CLICK_WINDOW_MS);
    },
    [clearPending, onOpenFull, onToggle],
  );

  // Keyboard users get the single-click behaviour with no delay: there is no double press to
  // wait for, and a dock that opened a fifth of a second after Enter would read as lag.
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.altKey && onMoveCorner && event.key in ARROWS) {
        event.preventDefault();
        onMoveCorner(ARROWS[event.key as keyof typeof ARROWS]);
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      clearPending();
      onToggle();
    },
    [clearPending, onToggle, onMoveCorner],
  );

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={isOpen ? "Close buddy chat" : "Open buddy chat"}
      aria-expanded={isOpen}
      title={
        isOpen
          ? "Minimise your buddy"
          : "Your buddy — click to open, double-click for the full page, drag to move it"
      }
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.6, ...position }}
      animate={{ opacity: 1, scale: 1, ...position }}
      transition={prefersReducedMotion ? { duration: 0 } : centralSpringToken}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
      whileDrag={prefersReducedMotion ? undefined : { scale: 1.1 }}
      drag
      // It lands where the widget puts it, not where a flick would have thrown it.
      dragMomentum={false}
      onDragStart={() => {
        dragged.current = true;
        clearPending();
        onDragStart?.();
      }}
      onDrag={() => onDrag?.()}
      onDragEnd={() => {
        onDragRelease?.();
        // The click that ends a drag arrives straight after this. If the pointer came up somewhere
        // else there is no click at all, and the flag must not swallow the next real one.
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      style={{ x: dragX, y: dragY }}
      // Above the page and above the rocket pet's corner (z-30), below the dock it opens.
      className="fixed z-40 flex size-16 items-center justify-center rounded-full border border-app-brand-border bg-app-surface shadow-lg transition-colors hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg focus-visible:outline-none"
    >
      {/* A soft brand halo behind the character, so the circle reads as its own surface on a
                busy page rather than as a hole punched in one. Decorative. */}
      <span aria-hidden="true" className="absolute inset-1 rounded-full bg-app-brand-soft" />

      {isOpen ? (
        // Points the way the dock folds away: down into a launcher at the bottom, up at the top.
        isTopCorner(corner) ? (
          <ChevronUp className="relative h-6 w-6 text-app-brand-text" aria-hidden="true" />
        ) : (
          <ChevronDown className="relative h-6 w-6 text-app-brand-text" aria-hidden="true" />
        )
      ) : (
        <span className="relative">
          {/* `tracksPointer` and the idle sleep are the point: left alone it nods off in the
                        corner, and looks up when the cursor comes near. */}
          <SleepyBot size={40} tracksPointer className="text-app-brand-text" />
        </span>
      )}
    </motion.button>
  );
}
