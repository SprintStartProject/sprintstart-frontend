import { useSyncExternalStore } from "react";

/**
 * Which corner of the viewport the buddy sits in. The dock opens beside the launcher, towards the
 * middle of the screen, so it is always on the same side as the character that opened it.
 */
export type BuddyCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const DEFAULT_CORNER: BuddyCorner = "bottom-right";

/** The launcher's diameter, in px — `size-16`. */
export const LAUNCHER_SIZE = 64;

/** Distance between the viewport's edges and the launcher, and between the dock and the side. */
export const EDGE_GAP = 24;

/** The dock's resting size. Big enough to hold a conversation, small enough to leave the page. */
const DOCK_WIDTH = 400;
const DOCK_HEIGHT = 560;

/** The space between the launcher and the dock it opens. */
const LAUNCHER_DOCK_GAP = 16;

/**
 * Below `lg` the app has a fixed 64px top bar (see `SideBar`), and a buddy in a top corner would sit
 * on its menu and avatar. Up there it keeps clear of the bar instead.
 */
const TOP_BAR_BREAKPOINT = 1024;
const TOP_BAR_HEIGHT = 64;

export const isTopCorner = (corner: BuddyCorner) => corner.startsWith("top");
export const isLeftCorner = (corner: BuddyCorner) => corner.endsWith("left");

/** Distance from the viewport's top edge to a launcher in a top corner. */
const topGap = (viewport: Viewport) =>
  viewport.width < TOP_BAR_BREAKPOINT ? TOP_BAR_HEIGHT + LAUNCHER_DOCK_GAP : EDGE_GAP;

/** Where the launcher's top-left corner sits in `corner`, in viewport px. */
export function launcherPosition(corner: BuddyCorner, viewport: Viewport) {
  return {
    left: isLeftCorner(corner) ? EDGE_GAP : viewport.width - EDGE_GAP - LAUNCHER_SIZE,
    top: isTopCorner(corner) ? topGap(viewport) : viewport.height - EDGE_GAP - LAUNCHER_SIZE,
  };
}

/**
 * The dock's resting box when its launcher is in `corner`, in viewport px.
 *
 * Every edge is a number rather than a `right`/`bottom` anchor, which is what lets Framer Motion
 * spring the window from one corner to another: switching which side it is anchored by is a jump,
 * not an animation. The caps keep it inside a short or narrow viewport, with the header — and the
 * controls in it — always on screen.
 */
export function dockBox(corner: BuddyCorner, viewport: Viewport) {
  const width = Math.max(0, Math.min(DOCK_WIDTH, viewport.width - EDGE_GAP * 2));
  const left = isLeftCorner(corner) ? EDGE_GAP : viewport.width - EDGE_GAP - width;
  const clamp = (room: number) => Math.max(0, Math.min(DOCK_HEIGHT, room));

  // Opens below a launcher at the top, down to a gap above the bottom edge.
  if (isTopCorner(corner)) {
    const top = launcherPosition(corner, viewport).top + LAUNCHER_SIZE + LAUNCHER_DOCK_GAP;
    return { width, left, top, height: clamp(viewport.height - top - EDGE_GAP) };
  }

  // Opens above a launcher at the bottom, up to a gap below the top edge.
  const bottom = EDGE_GAP + LAUNCHER_SIZE + LAUNCHER_DOCK_GAP;
  const height = clamp(viewport.height - bottom - EDGE_GAP);
  return { width, left, top: viewport.height - bottom - height, height };
}

/** The corner whose quarter of the viewport a point is in. */
export function nearestCorner(x: number, y: number, viewport: Viewport): BuddyCorner {
  const vertical = y < viewport.height / 2 ? "top" : "bottom";
  const horizontal = x < viewport.width / 2 ? "left" : "right";
  return `${vertical}-${horizontal}`;
}

/** The corner the dock grows out of — the one nearest its launcher. */
export function cornerTransformOrigin(corner: BuddyCorner) {
  return `${isTopCorner(corner) ? "top" : "bottom"} ${isLeftCorner(corner) ? "left" : "right"}`;
}

const CORNER_KEY = "buddyCorner";
const CORNERS: readonly BuddyCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

/** The corner the hire last put the buddy in, or the default when they never moved it. */
export function readCorner(): BuddyCorner {
  try {
    const stored = localStorage.getItem(CORNER_KEY);
    return CORNERS.find((corner) => corner === stored) ?? DEFAULT_CORNER;
  } catch {
    // Private modes can refuse storage outright. The buddy still sits in a corner.
    return DEFAULT_CORNER;
  }
}

export function writeCorner(corner: BuddyCorner): void {
  try {
    localStorage.setItem(CORNER_KEY, corner);
  } catch {
    // Nothing to do: it still moves, it just will not be remembered.
  }
}

export type Viewport = { width: number; height: number };

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

// `clientWidth` rather than `innerWidth`: a fixed box is laid out inside the scrollbar, not under
// it. jsdom reports 0 for it, hence the fallback.
const readWidth = () => document.documentElement.clientWidth || window.innerWidth;
const readHeight = () => document.documentElement.clientHeight || window.innerHeight;

/** The viewport's size right now, for event handlers that should not subscribe to it. */
export const readViewport = (): Viewport => ({ width: readWidth(), height: readHeight() });

/**
 * The viewport's size, kept current across resizes.
 *
 * The buddy is positioned in pixels (see {@link dockBox}), so a window that is resized has to move
 * it — a corner that was computed for the old size would leave the launcher stranded mid-screen.
 */
export function useViewportSize(): Viewport {
  const width = useSyncExternalStore(subscribe, readWidth);
  const height = useSyncExternalStore(subscribe, readHeight);
  return { width, height };
}
