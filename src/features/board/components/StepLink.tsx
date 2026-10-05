import { Milestone } from "lucide-react";
import { Link } from "react-router-dom";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import { useBoardPath } from "../hooks/boardPath";
import { titleKey } from "../layout/stepLinks";

/**
 * A `[[Step title]]` in a note, drawn as the step it names: a small chip that opens the step.
 *
 * A title that matches no step on the path — renamed, rebuilt away, or simply mistyped — stays
 * readable and says why it does not go anywhere, rather than disappearing or pretending to link.
 */
export function StepLink({ title }: { title: string }) {
  const { phases } = useBoardPath();
  const stepId = phases?.stepByTitle.get(titleKey(title));

  if (!stepId) {
    return (
      <span
        className="rounded-sm border-b border-dashed border-app-text-subtle text-app-text-muted"
        title={phases ? "No step with this name on your path" : undefined}
      >
        {title}
      </span>
    );
  }

  return (
    <Link
      to={onboardingPlaceUrl({ kind: "step", id: stepId })}
      className="inline-flex items-baseline gap-1 rounded-md bg-app-brand-soft px-1 font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      <Milestone className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      {title}
    </Link>
  );
}
