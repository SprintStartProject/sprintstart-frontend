import type { ReactNode } from "react";
import { Layers, ListChecks, Milestone } from "lucide-react";
import { Link } from "react-router-dom";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import { useBoardPath } from "../hooks/boardPath";
import { resolveLink, type ResolvedLink } from "../layout/pathStages";
import { titleKey } from "../layout/stepLinks";

type StepLinkProps =
  /** The inside of a `[[…]]` as written in the note: `Phase`, `Phase#Step` or `Phase#Step#Task`. */
  | { title: string; stepId?: never; label?: never }
  /** An in-app link to a step by id — what the buddy writes — and the words it wrote for it. */
  | { stepId: string; title?: never; label?: ReactNode };

/**
 * A link into the path in a note — a phase, a step, or a task in a step — drawn as a small chip
 * that opens it on the Onboarding page.
 *
 * Something that matches nothing on the path — renamed, rebuilt away, or simply mistyped — stays
 * readable and says why it does not go anywhere, rather than disappearing or pretending to link. It
 * reads as what it named last (`Setup#Set up SSH` reads "Set up SSH"), with the whole of it in the
 * tooltip, and a buddy's link keeps the words the buddy wrote for it.
 */
export function StepLink(props: StepLinkProps) {
  const { phases } = useBoardPath();

  let link: ResolvedLink | null = null;
  if (phases && props.title !== undefined) link = resolveLink(props.title, phases);
  if (phases && props.stepId !== undefined) {
    const phaseId = phases.phaseOfStep.get(props.stepId);
    link = phaseId ? { phaseId, stepId: props.stepId, task: null } : null;
  }

  const phase = link ? phases?.phaseInfo.get(link.phaseId) : undefined;
  if (!link || !phase) {
    const parts = (props.title ?? "")
      .split("#")
      .map((part) => part.trim())
      .filter(Boolean);
    const named = parts.length > 0 ? parts.join(" › ") : null;

    return (
      <span
        className="rounded-sm border-b border-dashed border-app-text-subtle text-app-text-muted"
        title={named ? `${named} — not on your path any more` : "Not on your path any more"}
      >
        {parts.length > 0 ? parts[parts.length - 1] : (props.label ?? "a step")}
      </span>
    );
  }

  const step = link.stepId ? phases?.steps.get(link.stepId) : undefined;
  // The task as the step spells it, when the path carries it; as written, when it does not.
  const task = link.task
    ? (step?.tasks.find((candidate) => titleKey(candidate.title) === titleKey(link.task ?? ""))
        ?.title ?? link.task)
    : null;

  const to = link.stepId
    ? onboardingPlaceUrl({ kind: "step", id: link.stepId })
    : onboardingPlaceUrl({ kind: "phase", id: link.phaseId });
  const full = [phase.title, step?.title, task].filter(Boolean).join(" › ");

  return (
    <Link
      to={to}
      title={full}
      className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-app-brand-soft px-1 align-baseline font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      {task ? (
        <ListChecks className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      ) : step ? (
        <Milestone className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      ) : (
        <Layers className="h-3 w-3 shrink-0 self-center" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">
        {task && step ? (
          <>
            <span className="font-normal opacity-80">{step.title} ›</span> {task}
          </>
        ) : (
          (step?.title ?? phase.title)
        )}
      </span>
    </Link>
  );
}
