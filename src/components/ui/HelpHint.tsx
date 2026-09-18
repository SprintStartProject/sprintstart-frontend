import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

const VIEWPORT_MARGIN = 12;
const OFFSET = 8;
const MAX_WIDTH = 300;

/** Above modals (`z-50`) and dropdowns (`100`), below toasts (`z-[200]`). */
const HINT_Z_INDEX = 150;

type Position = { left: number; top: number; width: number };

function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // An engine that does not know the selector: treat every focus as a keyboard one.
    return true;
  }
}

type HelpHintProps = {
  /** What is being explained, for the trigger's name: "About {topic}". */
  topic: string;
  /** The explanation. A sentence or two; more belongs on a page of its own. */
  children: ReactNode;
  className?: string;
};

/**
 * A small "?" beside something whose name alone does not say what it is. Hovering shows the
 * explanation, clicking pins it open (which is also how it works on touch), and a click
 * elsewhere or Escape closes it.
 *
 * Portaled and fixed-positioned rather than hung off the trigger like `InfoHint`: these sit in
 * card headers and figure tiles, inside frames that clip their overflow, and a hint on the right
 * edge of the page has to open leftwards instead of off-screen. CSS-driven, not framer-motion, so
 * it never inherits an `initial={false}` from the section animating around it.
 */
export function HelpHint({ topic, children, className = "" }: HelpHintProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleId = useId();
  const open = hovered || pinned;

  // Below the trigger when it fits, above it when not. The bubble's height is only known once it
  // is mounted, so the first pass assumes below and the layout effect corrects it before paint.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const height = bubbleRef.current?.offsetHeight ?? 0;
    const centred = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(centred, window.innerWidth - VIEWPORT_MARGIN - width),
    );
    const fitsBelow = rect.bottom + OFFSET + height <= window.innerHeight - VIEWPORT_MARGIN;
    const top =
      fitsBelow || rect.top - OFFSET - height < VIEWPORT_MARGIN
        ? rect.bottom + OFFSET
        : rect.top - OFFSET - height;

    setPosition({ left, top, width });
  }, []);

  // Followed rather than closed on scroll: a pinned explanation that vanishes the moment the page
  // moves is worse than one that stays with its "?". Capture phase, because a scroll inside a
  // nested container does not bubble to `window`.
  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    window.addEventListener("resize", updatePosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !bubbleRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`About ${topic}`}
        aria-expanded={open}
        aria-describedby={open ? bubbleId : undefined}
        // Mouse only: a tap raises `pointerenter` too, and would open the hint on the way to the
        // click that is meant to pin it.
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHovered(false);
        }}
        // Keyboard focus only; a click focuses the button too, and pins it itself.
        onFocus={(event) => {
          if (isFocusVisible(event.currentTarget)) setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          // A hint often sits inside something clickable -- a figure tile, a card header -- and
          // explaining it must not also open it.
          event.preventDefault();
          event.stopPropagation();
          if (pinned) setHovered(false);
          setPinned(!pinned);
        }}
        className={`relative z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
          open ? "text-app-brand-text" : "text-app-text-subtle hover:text-app-text"
        } ${className}`}
      >
        <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={bubbleId}
            role="tooltip"
            style={{
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              width: position?.width ?? MAX_WIDTH,
              zIndex: HINT_Z_INDEX,
              visibility: position ? "visible" : "hidden",
            }}
            className={`fixed rounded-xl border border-app-border/70 bg-app-surface/95 p-3 text-xs leading-relaxed text-app-text-muted shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[opacity,translate] duration-150 motion-reduce:transition-none starting:translate-y-1 starting:opacity-0 ${
              pinned ? "" : "pointer-events-none"
            }`}
          >
            <p className="mb-1 text-[11px] font-semibold text-app-text">{topic}</p>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
