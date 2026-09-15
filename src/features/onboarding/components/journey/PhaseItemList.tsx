import { ChevronRight, Eye, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import {
  formatMinutes,
  itemState,
  orderedPhaseItems,
  waitingOn,
  type ItemState,
  type PhaseItem,
} from "../../journey";
import { ItemKindIcon } from "../../graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel, primaryActionLabel } from "../../graph/nodeLabels";
import { StepOriginBadge } from "../StepOriginBadge";
import type { OnboardingPhaseEndpoint } from "../../types";
import { CheckCircle2, PlayCircle, RotateCcw, SkipForward, Sparkles } from "lucide-react";

const markerTone: Record<ItemState, string> = {
  done: "border-app-success-border bg-app-success-bg text-app-success-text",
  skipped: "border-app-border bg-app-surface-muted text-app-text-muted",
  active: "border-app-brand bg-app-brand text-white",
  open: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
  retry: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  locked: "border-dashed border-app-border bg-app-surface text-app-text-subtle",
};

const markerIcon: Record<ItemState, ReactNode> = {
  done: <CheckCircle2 className="h-4 w-4" />,
  skipped: <SkipForward className="h-4 w-4" />,
  active: <PlayCircle className="h-4 w-4" />,
  open: <Sparkles className="h-4 w-4" />,
  retry: <RotateCcw className="h-4 w-4" />,
  locked: <Lock className="h-3.5 w-3.5" />,
};

type Props = {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  onPrimary: (item: PhaseItem) => void;
  onView: (item: PhaseItem) => void;
};

/**
 * A phase's steps and questions as one list, in the order the phase graph reads.
 *
 * Steps and questions used to be two lists, steps first -- but they are nodes of one graph, and a
 * question often stands between two steps. So they are merged in graph order here, and anything
 * locked says what it is waiting on by name instead of only "Locked".
 */
export function PhaseItemList({ phase, nextItemId, onPrimary, onView }: Props) {
  const items = orderedPhaseItems(phase);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
        This phase has nothing in it yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-2" aria-label={`${phase.title}: steps and questions`}>
      {/* The spine the markers sit on. */}
      <span aria-hidden="true" className="absolute top-6 bottom-6 left-[27px] w-px bg-app-border" />
      {items.map((item) => {
        const state = itemState(item, phase.locked);
        const isNext = item.id === nextItemId;
        const action = primaryActionLabel(item, state);
        const blockers = state === "locked" ? waitingOn(item, items) : [];
        const minutes = item.kind === "step" ? item.step.estimatedMinutes : null;

        return (
          <li key={item.id} data-item-id={item.id} className="relative">
            <div
              className={`flex gap-4 rounded-2xl border p-3 pr-4 transition-colors sm:items-center ${
                isNext
                  ? "border-app-brand bg-app-brand-soft/60"
                  : state === "locked"
                    ? "border-transparent"
                    : "border-transparent hover:border-app-border hover:bg-app-surface"
              }`}
            >
              <span
                className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:mt-0 ${markerTone[state]}`}
                aria-hidden="true"
              >
                {markerIcon[state]}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isNext ? (
                      <span className="rounded-full bg-app-brand px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                        Up next
                      </span>
                    ) : null}
                    <h3
                      className={`text-sm font-semibold ${
                        state === "done" || state === "skipped"
                          ? "text-app-text-subtle line-through decoration-app-text-subtle/40"
                          : state === "locked"
                            ? "text-app-text-muted"
                            : "text-app-text"
                      }`}
                    >
                      {item.kind === "question" ? item.question.question : item.title}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-text-subtle">
                    <span className="inline-flex items-center gap-1">
                      <ItemKindIcon item={item} className="h-3.5 w-3.5" />
                      {itemKindLabel(item)}
                    </span>
                    {minutes ? <span>{formatMinutes(minutes)}</span> : null}
                    <span className="sr-only">{itemStateLabel[state]}</span>
                    {item.kind === "step" ? <StepOriginBadge step={item.step} /> : null}
                  </div>
                  {blockers.length > 0 ? (
                    <p className="mt-1.5 text-xs text-app-text-muted">
                      Waits on{" "}
                      {blockers.map((blocker, index) => (
                        <span key={blocker.id}>
                          {index > 0 ? ", " : ""}
                          <span className="font-medium text-app-text">{blocker.title}</span>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  {action ? (
                    <Button
                      size="sm"
                      variant={isNext ? "primary" : "secondary"}
                      onClick={() => onPrimary(item)}
                      trailingIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      {action}
                    </Button>
                  ) : item.kind === "step" && state !== "locked" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onView(item)}
                      icon={<Eye className="h-4 w-4" />}
                    >
                      View
                    </Button>
                  ) : (
                    <span className="text-xs font-medium text-app-text-subtle">
                      {itemStateLabel[state]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
