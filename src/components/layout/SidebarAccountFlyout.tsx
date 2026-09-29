import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

/** Long enough to cross the gap from the icon to the card without it closing in between. */
const CLOSE_DELAY_MS = 200;

type SidebarAccountFlyoutProps = {
  /** What the folded rail shows in place of the footer card: the user's avatar. */
  trigger: ReactNode;
  /** Names the button for assistive technology, since it shows only a picture. */
  label: string;
  /** The footer card as the open sidebar shows it. */
  children: ReactNode;
};

/**
 * The sidebar footer for the rail folded to icons: one icon that slides the full footer card
 * out beside the rail on hover, or on click and from the keyboard, where there is no hover.
 *
 * The card stays mounted while hidden (`inert` and transparent) rather than being removed: the
 * project switcher inside it owns the Cmd/Ctrl+K shortcut and its modal, and both have to keep
 * working while the card is closed -- including after the pointer has left it for the modal.
 *
 * Drawn in a portal at a fixed position beside the rail, which reads the rail's width from the
 * same CSS variable the sidebar does: the nav and footer clip anything past their edge.
 */
export function SidebarAccountFlyout({ trigger, label, children }: SidebarAccountFlyoutProps) {
  /**
   * Opened by hover it follows the pointer and closes when it leaves; opened by a click (or
   * clicked while hovered open) it stays until Escape, a click elsewhere or a second click.
   * Without the difference, hovering the icon and then clicking it -- the natural thing to do
   * with a mouse -- closed the card the hover had just opened.
   */
  const [mode, setMode] = useState<"closed" | "hover" | "pinned">("closed");
  const open = mode !== "closed";
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const openNow = () => {
    cancelClose();
    setMode((current) => (current === "pinned" ? current : "hover"));
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(
      () => setMode((current) => (current === "pinned" ? current : "closed")),
      CLOSE_DELAY_MS,
    );
  };

  useEffect(() => cancelClose, []);

  // Going somewhere from it (Settings) is done with it. Adjusted while rendering rather than in
  // an effect, so the card never shows open on the new page for a frame.
  const { pathname } = useLocation();
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMode("closed");
  }

  // Escape and a click anywhere else close it, as for any popover.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const focusWasInside = panelRef.current?.contains(document.activeElement) ?? false;
      setMode("closed");
      if (focusWasInside) triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMode("closed");
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        // Hover only for a mouse: a touch "enter" is followed by a click, which would toggle it
        // straight back shut.
        onPointerEnter={(event) => event.pointerType === "mouse" && openNow()}
        onPointerLeave={(event) => event.pointerType === "mouse" && closeSoon()}
        onClick={(event) => {
          cancelClose();
          const opening = mode !== "pinned";
          setMode(opening ? "pinned" : "closed");
          // From the keyboard, into the card: portalled to the end of the page, it is not next
          // in the tab order.
          if (opening && event.detail === 0) {
            window.requestAnimationFrame(() =>
              panelRef.current
                ?.querySelector<HTMLElement>("a[href], button:not(:disabled)")
                ?.focus(),
            );
          }
        }}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
          open
            ? "border-app-brand-border bg-app-brand-soft"
            : "border-app-border/70 bg-app-surface/70 hover:border-app-brand-border"
        }`}
      >
        {trigger}
      </button>

      {createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={label}
          inert={!open}
          onPointerEnter={(event) => event.pointerType === "mouse" && openNow()}
          onPointerLeave={(event) => event.pointerType === "mouse" && closeSoon()}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !panelRef.current?.contains(next) && !triggerRef.current?.contains(next)) {
              setMode("closed");
            }
          }}
          // Slides out of the rail from its bottom-left corner, the way the footer card would
          // have unfolded had there been room for it.
          className={`fixed bottom-[16px] left-[calc(var(--app-sidebar-desktop-width,var(--app-sidebar-width))+10px)] z-40 hidden w-[262px] origin-bottom-left transition duration-200 ease-out motion-reduce:transition-none lg:block ${
            open
              ? "translate-x-0 scale-100 opacity-100"
              : "pointer-events-none -translate-x-3 scale-95 opacity-0"
          }`}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
