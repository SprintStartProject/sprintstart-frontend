import { ChevronRight, CircleHelp, PlayCircle } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { primaryActionLabel } from "../../graph/nodeLabels";
import { itemState, type ItemState, type PhaseItem } from "../../journey";
import type { OnboardingPhaseEndpoint } from "../../types";

function eyebrow(state: ItemState, isQuestion: boolean): string {
  if (state === "active") return "In progress";
  return isQuestion ? "Knowledge question" : "Up next";
}

function buttonLabel(action: string): string {
  if (action === "Start") return "Start now";
  return action === "Answer" ? "Answer now" : action;
}

/** The line under the title: a step's own description, or what a question asks of the hire. */
function Detail({ item, state }: { item: PhaseItem; state: ItemState }) {
  if (item.kind === "step") {
    return item.step.description ? (
      <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-app-text-muted">
        {item.step.description}
      </p>
    ) : null;
  }
  return (
    <p className="mt-1 text-sm text-app-text-muted">
      {state === "retry"
        ? "You got this one wrong before — answer it correctly to move on."
        : "Answer this question to move on in your onboarding."}
    </p>
  );
}

type Props = {
  phase: OnboardingPhaseEndpoint;
  phaseIndex: number;
  item: PhaseItem | undefined;
  onPrimary: (item: PhaseItem) => void;
  onShowPhase: () => void;
};

/**
 * The one thing to do next, on top of everything else.
 */
export function UpNextCard({ phase, phaseIndex, item, onPrimary, onShowPhase }: Props) {
  if (!item) return null;
  const state = itemState(item, phase.locked);
  const action = primaryActionLabel(item, state) ?? "Open";
  const isQuestion = item.kind === "question";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface">
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-brand text-white shadow-[0_10px_30px_-10px_var(--color-app-brand)]">
            {isQuestion ? (
              <CircleHelp className="h-6 w-6" aria-hidden="true" />
            ) : (
              <PlayCircle className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-app-brand-text uppercase">
              {eyebrow(state, isQuestion)} ·{" "}
              <button
                type="button"
                onClick={onShowPhase}
                className="uppercase underline-offset-2 hover:underline"
              >
                Phase {phaseIndex + 1}: {phase.title}
              </button>
            </p>
            <h2 className="mt-1 text-lg leading-snug font-bold text-app-text sm:text-xl">
              {item.kind === "question" ? item.question.question : item.title}
            </h2>
            <Detail item={item} state={state} />
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="shrink-0 self-start sm:self-center"
          onClick={() => onPrimary(item)}
          trailingIcon={<ChevronRight className="h-4 w-4" />}
        >
          {buttonLabel(action)}
        </Button>
      </div>
    </div>
  );
}
