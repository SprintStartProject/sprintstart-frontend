import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** What the panel puts in history state when it hands a conversation over to `/buddy`. */
export type BuddyHandoffState = { draft?: string };

/**
 * Applies a draft handed over from the floating panel, exactly once.
 *
 * The panel and the page share one buddy *session* but not one composer, so the draft has to be
 * carried across the navigation or it is silently thrown away.
 *
 * The history state is consumed and then removed (`replace`). Without that, going back and
 * forward again — or a reload — re-seeds a draft the hire has since sent or deleted, overwriting
 * whatever is in the box. A blank or absent draft does nothing at all.
 *
 * Call this from exactly one place per route. Two consumers on one page read the same
 * payload, and the parent's effect runs after the child has already cleared it, so the second fires
 * with a stale value and navigates again.
 *
 * @param setDraft The composer setter of whichever conversation is mounted.
 */
export function useHandedOffDraft(setDraft: (draft: string) => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const handed = (location.state as BuddyHandoffState | null)?.draft;

  // Clearing the state is not enough on its own to make this fire once. Applying the draft
  // re-renders the caller, and a caller whose `setDraft` is not referentially stable gives the
  // effect a new dependency on that render — so it runs again *before* the navigation has taken
  // the payload off the location, and applies the same draft twice. A test caught exactly that.
  // The guard makes the hook independent of how the caller happens to define its setter.
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!handed?.trim() || applied.current === handed) return;

    applied.current = handed;
    setDraft(handed);
    // Replace rather than push: this is the same page, with the one-shot payload taken off it.
    void navigate(location.pathname + location.search, { replace: true, state: null });
  }, [handed, setDraft, navigate, location.pathname, location.search]);
}
