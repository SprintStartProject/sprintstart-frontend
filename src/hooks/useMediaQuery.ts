import { useEffect, useState } from "react";

/**
 * Tracks whether a CSS media query currently matches, re-rendering when it
 * flips. Used to branch behaviour that CSS alone cannot express — e.g. mounting
 * a component in a side drawer on desktop but inline on a phone.
 *
 * Reads the initial value synchronously so the first render is already correct
 * (no flash), then subscribes for changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);

    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
