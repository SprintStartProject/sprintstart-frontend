import { useEffect, useLayoutEffect } from "react";
import { NavigationType, useLocation, useNavigationType } from "react-router-dom";
import { SCROLL_CONTAINER_ATTRIBUTE } from "../components/ui/useScrollLock";

const STORAGE_KEY = "sprintstart:scroll-positions";

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
 */
export function useScrollRestoration(): void {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    history.scrollRestoration = "manual";
  }, []);

  // Runs before paint so a restored position, or the reset to the top, is
  // never visible as a jump.
  useLayoutEffect(() => {
    const host = getScrollHost();
    if (navigationType === NavigationType.Pop) {
      scrollHostTo(host, readPositions()[location.key] ?? 0);
    } else {
      scrollHostTo(host, 0);
    }
  }, [location.key, navigationType]);

  // Keeps the current page's position current for whenever the reader comes back to it.
  useEffect(() => {
    const host = getScrollHost();
    const handleScroll = () => writePosition(location.key, getScrollTop(host));
    host.addEventListener("scroll", handleScroll, { passive: true });
    return () => host.removeEventListener("scroll", handleScroll);
  }, [location.key]);
}
