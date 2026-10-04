import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { OnboardingNextAction } from "../../onboarding/nextAction";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";

type BoardNextUpProps = {
  /** What the path says to do next, or null while it loads and when there is no path. */
  next: OnboardingNextAction | null;
};

/**
 * One line, above everything: what is next on your path.
 *
 * It used to be "start with" one of the board's own cards — the first open one in the hire's
 * chains. Since the path became the one plan that was a second answer to the question the path
 * already answers, and the two could disagree. So the line now says what the Onboarding page would
 * say, and goes there: the board is where things are kept, the path is where the work is.
 *
 * It finds the step rather than starting it (`?step=`), the same way a link from the buddy does —
 * reading a line on the board is not the same as deciding to begin.
 *
 * Silent when there is nothing to say: no path yet, or the path finished.
 */
export function BoardNextUp({ next }: BoardNextUpProps) {
  if (!next || next.kind === "done") return null;

  const target =
    next.kind === "step"
      ? {
          to: onboardingPlaceUrl({ kind: "step", id: next.step.id }),
          name: next.step.title,
          lead: "Next on your path:",
        }
      : next.kind === "question"
        ? {
            to: `/onboarding?question=${encodeURIComponent(next.question.id)}`,
            name: next.question.title || "a knowledge check",
            lead: "Next on your path:",
          }
        : { to: "/onboarding", name: "pick your next phase", lead: "Next on your path —" };

  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-app-text-muted">
      <span>{target.lead}</span>
      <Link
        to={target.to}
        className="inline-flex items-center gap-1 font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        {target.name}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </p>
  );
}
