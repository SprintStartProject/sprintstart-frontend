import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Distance between the trigger and the menu, whichever side it opens on. */
export const MENU_OFFSET = 6;

/** How tall the menu may get before it scrolls. */
export const MENU_MAX_HEIGHT = 256;

/** Breathing room kept between the menu and the edge of the viewport. */
export const VIEWPORT_MARGIN = 8;

/**
 * Below this, "there is room underneath" stops being true in any useful sense
 * and the menu flips above the trigger instead.
 */
export const MIN_USABLE_HEIGHT = 160;

/**
 * Above modals (`z-50` on `<body>`), below toasts (`z-[200]`).
 *
 * A dropdown opened from inside a dialog has to clear it, and a toast arriving
 * while one is open has to clear the dropdown.
 */
export const MENU_Z_INDEX = 100;

/**
 * How a portaled menu arrives and leaves. A short tween rather than one of the
 * app's springs: the menu is anchored to the trigger by measured coordinates, so
 * anything that overshoots would visibly detach from the control it hangs from.
 */
export const menuTransition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] } as const;

/**
 * Where the menu is painted, in viewport coordinates.
 *
 * Anchored by `top` when it opens downwards and by `bottom` when it flips, so
 * the edge that touches the trigger is the one that stays put — pinning `top`
 * for an upward menu would make it grow away from the control as options are
 * filtered.
 */
export type MenuPosition = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  maxWidth: number;
  isAbove: boolean;
};

/**
 * Open/close state, outside-dismissal and measured placement for a portaled
 * menu — the behaviour `FilterSelect` and `MultiSelectFilter` both need.
 *
 * **The menu is rendered into `<body>`, not next to the trigger.** As an
 * absolutely positioned sibling its `z-index` only counted inside whatever
 * stacking context the caller happened to sit in, and any ancestor with
 * `backdrop-filter`, `filter`, `transform` or `opacity` makes one — so a
 * dropdown opened inside a `backdrop-blur` card was painted *underneath* the
 * card below it and its options could not be clicked. A portal is the only way
 * out, and it also stops an ancestor's `overflow: hidden` clipping the menu.
 *
 * The cost is that the menu no longer moves with the trigger for free, so its
 * position is measured on open and re-measured on scroll and resize. That
 * measurement, and the three ways it can go wrong, lives here once rather than
 * in every control that wants a menu.
 *
 * @returns `menuRef` must be attached to the portaled element itself, not to a
 *   wrapper — its width and its bounds are what "outside" and "wide enough" are
 *   measured against.
 */
export function usePopoverMenu<TMenu extends HTMLElement = HTMLDivElement>() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<TMenu>(null);

  /**
   * Measures the trigger and decides which side the menu opens on.
   *
   * Downwards unless the space under the trigger has stopped being usable and
   * there is more of it above — a control near the bottom of the window would
   * otherwise open into a two-option sliver.
   *
   * Horizontally the menu is left-aligned with the trigger but never allowed
   * past either edge of the window. It may be wider than the control it hangs
   * from — options do not wrap, so a long label grows the list sideways — which
   * for a trigger near the right edge, like the size picker in a dashboard
   * widget's toolbar, would otherwise put the menu half off-screen. Its own
   * width is only knowable once it is mounted, so this reads it back when there
   * is one to read and falls back to the trigger's width on the first pass.
   */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_OFFSET - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_OFFSET - VIEWPORT_MARGIN;
    const isAbove = spaceBelow < MIN_USABLE_HEIGHT && spaceAbove > spaceBelow;
    const available = isAbove ? spaceAbove : spaceBelow;

    const maxWidth = Math.max(window.innerWidth - VIEWPORT_MARGIN * 2, 0);
    const menuWidth = Math.min(Math.max(menuRef.current?.offsetWidth ?? 0, rect.width), maxWidth);
    const furthestLeft = window.innerWidth - VIEWPORT_MARGIN - menuWidth;

    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, furthestLeft)),
      width: rect.width,
      top: isAbove ? undefined : rect.bottom + MENU_OFFSET,
      bottom: isAbove ? window.innerHeight - rect.top + MENU_OFFSET : undefined,
      maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(available, 0)),
      maxWidth,
      isAbove,
    });
  }, []);

  const open = useCallback(() => {
    // Measured before the menu is mounted, so it is never painted at 0,0 first.
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Re-measured rather than closed on scroll: a filter bar inside a scrolling
  // page is the normal case, and a menu that vanishes the moment the page moves
  // under the pointer is worse than one that follows. Capture phase, because a
  // scroll inside a nested container does not bubble to `window`.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const handle = () => updatePosition();

    // Once more now that the menu exists: the measurement taken on open could
    // only guess its width from the trigger, and a menu wider than its control
    // may need to sit further left. Before paint, so it never appears to jump.
    handle();

    window.addEventListener("scroll", handle, { capture: true, passive: true });
    window.addEventListener("resize", handle, { passive: true });

    return () => {
      window.removeEventListener("scroll", handle, { capture: true });
      window.removeEventListener("resize", handle);
    };
  }, [isOpen, updatePosition]);

  // Pointer interactions outside the control dismiss it. `pointerdown` rather
  // than `click`, so the menu is gone before the click lands on whatever is
  // underneath — and rather than `mousedown`, which on a touch device only
  // arrives as an emulated event after the tap, or not at all.
  //
  // The menu has to be tested separately from the container: it is portaled into
  // `<body>`, so `containerRef` no longer contains it, and checking the container
  // alone would treat a press on an option as an outside click — unmounting the
  // option before the click that selects it could land.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        close();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, close]);

  return { isOpen, position, containerRef, triggerRef, menuRef, open, close, updatePosition };
}
