import { ListChecks, Milestone } from "lucide-react";
import { Link } from "react-router-dom";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import { useBoardPath } from "../hooks/boardPath";
import { linkTarget, titleKey } from "../layout/stepLinks";

type StepLinkProps =
  /** A `[[Step]]` or `[[Step#Task]]` as written in the note. */
  | { title: string; stepId?: never }
  /** An in-app link to a step by id — what the buddy writes. */
  | { stepId: string; title?: never };

/**
 * A link to a step (or a task in it) in a note, drawn as a small chip that opens the step.
 *
 * A title that matches no step on the path — renamed, rebuilt away, or simply mistyped — stays
 * readable and says why it does not go anywhere, rather than disappearing or pretending to link.
 */
export function StepLink(props: StepLinkProps) {
  const { phases } = useBoardPath();
  const target = props.title !== undefined ? linkTarget(props.title) : null;
  const stepId =
    props.stepId ?? (target ? phases?.stepByTitle.get(titleKey(target.step)) : undefined);
  const step = stepId ? phases?.steps.get(stepId) : undefined;

  if (!stepId || !step) {
    return (
      <span
        className="rounded-sm border-b border-dashed border-app-text-subtle text-app-text-muted"
        title={phases ? "No step with this name on your path" : undefined}
      >
        {props.title ?? "a step"}
      </span>
    );
  }

  // The task as the step spells it, when it is there; as written, when it is not.
  const task = target?.task
    ? (step.tasks.find((candidate) => titleKey(candidate.title) === titleKey(target.task ?? ""))
        ?.title ?? target.task)
    : null;

  return (
    <Link
      to={onboardingPlaceUrl({ kind: "step", id: stepId })}
      title={task ? `${step.title} › ${task}` : step.title}
      className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-app-brand-soft px-1 align-baseline font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {task ? (
        <ListChecks className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      ) : (
        <Milestone className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">
        {task ? (
          <>
            <span className="font-normal opacity-80">{step.title} ›</span> {task}
          </>
        ) : (
          step.title
        )}
      </span>
    </Link>
  );
}
