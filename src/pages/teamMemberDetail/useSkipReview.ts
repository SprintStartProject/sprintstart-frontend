import { useRef, useState } from "react";
import { useToast } from "../../context/useToast";
import type { SkipDecision } from "../../features/pm-area/useMemberOpenItems";
import {
  acceptOnboardingSkipRequest,
  denyOnboardingSkipRequest,
} from "../../services/teamManagementService";
import type { MemberData } from "./useMemberData";

/**
 * Answers a skip request -- the current step's from the card below, or any step's from where the
 * step is shown. Phases run side by side, so the one waiting is not always the current step.
 *
 * One decision per request, and only one in flight: both surfaces can be on screen at once, the
 * answer cannot be retried once it is in, and a skip accepted and declined within the same second
 * would be settled by whichever call the server happened to finish last.
 */
export function useSkipReview({ refreshMember, refreshOnboardingPath }: MemberData) {
  const toast = useToast();
  // Keyed on the skip, not on the page. The set is the guard (a second click in the same tick
  // still sees it), the state is what disables both controls and shows the spinner on the button
  // that was pressed.
  const inReview = useRef(new Set<string>());
  const [reviewing, setReviewing] = useState<Readonly<Record<string, SkipDecision>>>({});

  function release(skipId: string) {
    inReview.current.delete(skipId);
    setReviewing((current) => {
      const next = { ...current };
      delete next[skipId];
      return next;
    });
  }

  async function decide(skipId: string, action: SkipDecision, comment: string) {
    if (action === "accept") await acceptOnboardingSkipRequest(skipId, comment);
    else await denyOnboardingSkipRequest(skipId, comment);
  }

  async function review(skipId: string, action: SkipDecision, comment = "") {
    if (inReview.current.has(skipId)) return;
    inReview.current.add(skipId);
    setReviewing((current) => ({ ...current, [skipId]: action }));

    try {
      await decide(skipId, action, comment);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't review the skip request.");
      // Only a decision that never landed can be made again.
      release(skipId);
      return;
    }

    toast.success(action === "accept" ? "Skip request approved" : "Skip request declined");
    // Told apart from a failed decision: the answer is in, and retrying it would be refused.
    try {
      await Promise.all([refreshMember(), refreshOnboardingPath()]);
      // Held until here, not released when the request came back: until the refresh lands, both
      // surfaces still draw the request as pending, and a second decision would be sent against
      // one the server has already answered.
      release(skipId);
    } catch {
      // The guard stays on for good in this case, for the same reason: what is on screen is a
      // request that has in fact been answered.
      toast.error("The answer was saved, but the page could not refresh. Reload to see it.");
    }
  }

  return { reviewing, review };
}
