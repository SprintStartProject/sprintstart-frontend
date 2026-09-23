import { useEffect, useLayoutEffect, useRef } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router-dom";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../components/ui/useScrollLock";

const STORAGE_KEY = "sprintstart:scroll-positions";
const MAX_RESTORE_WAIT_MS = 10_000;

type ScrollPositions = Record<string, number>;

function readPositions(): ScrollPositions {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScrollPositions) : {};
  } catch {
    return {};
  }
}

function writePosition(key: string, value: number): void {
  try {
    const positions = readPositions();
    positions[key] = value;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Private browsing or a full quota loses scroll restoration, not the navigation.
  }
}

type ScrollHost = Window | HTMLElement;

type PendingRestoration = {
  key: string;
  target: number;
};

/** Most pages scroll the window; the couple that own their scrolling mark it — see `useScrollLock`. */
function getScrollHost(): ScrollHost {
  return document.querySelector<HTMLElement>(`[${SCROLL_CONTAINER_ATTRIBUTE}]`) ?? window;
}

function getScrollTop(host: ScrollHost): number {
  return host === window ? window.scrollY : (host as HTMLElement).scrollTop;
}

function scrollHostTo(host: ScrollHost, y: number): void {
  host.scrollTo(0, y);
}

/**
 * Hand-rolled scroll restoration: the app runs on `<BrowserRouter>`, not a data
 * router, so react-router's own `<ScrollRestoration>` isn't available.
 *
 * Back/forward (`POP`) restores where the reader left off; a regular navigation
 * (`PUSH`/`REPLACE`) starts at the top, the way a fresh page normally would.
 * Positions live in `sessionStorage` keyed by the location's history key, so
 * they survive a reload but not a closed tab.
 *
 * A POP restoration remains pending while a loading shell is too short to reach
 * the saved position. DOM/size changes retry it until the real page is tall
 * enough. Any user input cancels the pending retry so restoration never fights
 * someone who has already started interacting with the page.
 */
export function useScrollRestoration(): void {
  const location = useLocation();
  const navigationType = useNavigationType();
  const pendingRestorationRef = useRef<PendingRestoration | null>(null);
  const prevPathnameRef = useRef(location.pathname);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    const isFirstRender = isFirstRenderRef.current;
    isFirstRenderRef.current = false;
    const initialHost = getScrollHost();
    const pathnameChanged = prevPathnameRef.current !== location.pathname;
    prevPathnameRef.current = location.pathname;

    const preventScrollReset = Boolean(
      (location.state as { preventScrollReset?: boolean } | null)?.preventScrollReset,
    );

    if (navigationType !== NavigationType.Pop) {
      if ((pathnameChanged || isFirstRender) && !preventScrollReset) {
        pendingRestorationRef.current = null;
        scrollHostTo(initialHost, 0);
      }
      return;
    }

    const target = readPositions()[location.key] ?? 0;
    pendingRestorationRef.current = target > 0 ? { key: location.key, target } : null;
    scrollHostTo(initialHost, target);

    if (target === 0 || Math.abs(getScrollTop(initialHost) - target) <= 1) {
      pendingRestorationRef.current = null;
      return;
    }

    let mutationObserver: MutationObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: number | null = null;
    let stopped = false;

    const stopWatching = () => {
      if (stopped) return;
      stopped = true;
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener("resize", attemptRestoration);
      window.removeEventListener("wheel", cancelRestoration, true);
      window.removeEventListener("touchstart", cancelRestoration, true);
      window.removeEventListener("pointerdown", cancelRestoration, true);
      window.removeEventListener("keydown", cancelRestoration, true);
    };

    function cancelRestoration() {
      if (pendingRestorationRef.current?.key === location.key) {
        pendingRestorationRef.current = null;
      }
      stopWatching();
    }

    function attemptRestoration() {
      if (stopped || pendingRestorationRef.current?.key !== location.key) return;
      const host = getScrollHost();
      scrollHostTo(host, target);
      if (Math.abs(getScrollTop(host) - target) <= 1) {
        pendingRestorationRef.current = null;
        stopWatching();
      }
    }

    mutationObserver = new MutationObserver(attemptRestoration);
    // Watch the document so restoration also survives a loading shell replacing the
    // original scroll container instead of merely growing inside it.
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(attemptRestoration);
      resizeObserver.observe(
        initialHost === window ? document.documentElement : (initialHost as HTMLElement),
      );
    }

    window.addEventListener("resize", attemptRestoration);
    window.addEventListener("wheel", cancelRestoration, true);
    window.addEventListener("touchstart", cancelRestoration, true);
    window.addEventListener("pointerdown", cancelRestoration, true);
    window.addEventListener("keydown", cancelRestoration, true);
    timeoutId = window.setTimeout(cancelRestoration, MAX_RESTORE_WAIT_MS);

    return () => {
      stopWatching();
      if (pendingRestorationRef.current?.key === location.key) {
        pendingRestorationRef.current = null;
      }
    };
  }, [location.key, location.pathname, location.state, navigationType]);

  // Keeps the current page's position current for whenever the reader comes back to it.
  useEffect(() => {
    const host = getScrollHost();
    let rafId: number | null = null;
    let latestScrollTop = getScrollTop(host);

    // The actual sessionStorage read-modify-write, run at most once per animation
    // frame -- a wheel or trackpad scroll fires dozens of `scroll` events a second,
    // and none of them need their own JSON round trip.
    const flush = () => {
      rafId = null;
      const pending = pendingRestorationRef.current;

      // A browser may emit a scroll event for a clamped restoration attempt. Do
      // not replace the saved target with that temporary, too-short position.
      if (pending?.key === location.key) {
        if (Math.abs(latestScrollTop - pending.target) > 1) return;
        pendingRestorationRef.current = null;
      }

      writePosition(location.key, latestScrollTop);
    };

    const handleScroll = () => {
      latestScrollTop = getScrollTop(host);
      if (rafId === null) rafId = window.requestAnimationFrame(flush);
    };

    host.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      host.removeEventListener("scroll", handleScroll);
      // A frame still pending when the route changes would otherwise never run,
      // silently dropping the last position of a reader who scrolled and left fast.
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        flush();
      }
    };
  }, [location.key]);
}
