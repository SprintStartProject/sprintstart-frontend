import { useEffect, useState } from "react";
import { getSuggestions, type BuddySuggestion } from "../../../services/buddyService";

/**
 * The chips this hire could usefully ask, for whichever buddy surface is showing.
 *
 * The list comes from the server and must not be derived here. The backend builds it from
 * the very tools it mounts for that hire, so the chips and the mentor cannot disagree; deriving it
 * from a role would be a second opinion about the same question.
 *
 * Failure is silence. A chip row is an invitation, not information: a failed call leaves no
 * chips and a working composer, never an error.
 *
 * @param enabled Fetch only once the surface is actually showing (the widget defers until the panel
 *   is first opened, so an unopened widget makes no request).
 */
export function useBuddySuggestions(enabled = true): BuddySuggestion[] {
  const [suggestions, setSuggestions] = useState<BuddySuggestion[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Deferred to a microtask (the repo's React-19 pattern) so the first setState never runs
    // synchronously in the effect body.
    void (async () => {
      try {
        const loaded = await getSuggestions();
        if (!cancelled) setSuggestions(loaded);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return suggestions;
}
