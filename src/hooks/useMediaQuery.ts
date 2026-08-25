import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks whether a CSS media query currently matches, re-rendering when it
 * flips. Used to branch behaviour that CSS alone cannot express — e.g. mounting
 * a component in a side drawer on desktop but inline on a phone.
 *
 * Built on `useSyncExternalStore` so the matched state is read straight from the
 * `MediaQueryList` during render — no `useEffect` catch-up frame and no tearing
 * during concurrent renders — with a server snapshot of `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
