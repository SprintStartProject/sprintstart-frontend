import { useCallback, useEffect, useState } from "react";

/** The desktop sidebar's width before anyone has changed it. */
export const SIDEBAR_DEFAULT_WIDTH = 286;
/**
 * Narrow enough to give a page room, wide enough that the longest entry ("Access Management")
 * and a count badge still fit on one line beside their icon.
 */
export const SIDEBAR_MIN_WIDTH = 240;
/** Past this the sidebar stops being navigation and starts taking the page's space. */
export const SIDEBAR_MAX_WIDTH = 400;
/** Icons only: an entry's 44px row plus the nav's padding. */
export const SIDEBAR_COLLAPSED_WIDTH = 76;
/** How far one arrow key press on the resize handle moves the edge. */
export const SIDEBAR_WIDTH_STEP = 16;

const STORAGE_KEY = "sprintstart.sidebar-layout";

/**
 * The CSS variable the desktop sidebar's width lives in, on the root element: the sidebar is
 * `fixed`, so the page leaves room for it with a margin that reads the same variable. Separate
 * from `--app-sidebar-width`, which the mobile drawer keeps using at its fixed width.
 */
export const SIDEBAR_WIDTH_VAR = "--app-sidebar-desktop-width";

export type SidebarLayout = { width: number; collapsed: boolean };

export function clampSidebarWidth(width: number): number {
  return Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)));
}

const DEFAULT_LAYOUT: SidebarLayout = { width: SIDEBAR_DEFAULT_WIDTH, collapsed: false };

/**
 * Reads the saved layout, falling back to the default for anything missing or malformed.
 * Storage can throw outright (a private window, blocked site data), which is just "nothing saved".
 */
function readLayout(): SidebarLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const saved = JSON.parse(raw) as Partial<SidebarLayout> | null;
    return {
      width:
        typeof saved?.width === "number" && Number.isFinite(saved.width)
          ? clampSidebarWidth(saved.width)
          : SIDEBAR_DEFAULT_WIDTH,
      collapsed: saved?.collapsed === true,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/**
 * The desktop sidebar's width and whether it is collapsed to icons, kept in `localStorage` so
 * both are still there on the next visit.
 *
 * Per browser rather than per account: how wide a sidebar should be depends on the screen it is
 * on, and the same person on a laptop and on a wide monitor wants two different answers.
 */
export function useSidebarLayout() {
  const [layout, setLayout] = useState<SidebarLayout>(readLayout);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Not saved; the layout still holds for this visit.
    }
  }, [layout]);

  const setWidth = useCallback((width: number) => {
    setLayout((current) => ({ ...current, width: clampSidebarWidth(width) }));
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setLayout((current) => ({ ...current, collapsed }));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setLayout((current) => ({ ...current, collapsed: !current.collapsed }));
  }, []);

  return { ...layout, setWidth, setCollapsed, toggleCollapsed };
}
