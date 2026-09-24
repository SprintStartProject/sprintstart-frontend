import { motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import {
  formatMinutes,
  itemState,
  linkedCardId,
  orderedPhaseItems,
  waitingOn,
  type PhaseItem,
} from "../../journey";
import { ItemFlags, ItemGlyph } from "../../graph/JourneyNodeCards";
import { itemKindLabel, itemStateLabel, primaryActionLabel } from "../../graph/nodeLabels";
import type { OnboardingPhaseEndpoint } from "../../types";

type Props = {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  /** The item unfolded in place, if any. */
  expandedItemId: string | null;
  /**
   * The item a link from the buddy landed on, lit up once. `key` is per arrival, so the same link
   * followed twice plays the light twice.
   */
  linkHighlight?: { id: string; key: string } | null;
  onToggle: (item: PhaseItem) => void;
  /** Start, continue or answer: opens the item in place, starting a step that was not started. */
  onPrimary: (item: PhaseItem) => void;
  /** What an unfolded item shows -- the step or question itself. */
  renderExpanded: (item: PhaseItem) => ReactNode;
};

/**
 * A phase's steps and questions as one list, in the order the phase graph reads -- and the place
 * they are worked through.
 *
 * Every row unfolds in place instead of leading to a page of its own, so the member never loses the
 * path around the step they are on. Questions are drawn in their own colour and shape, locked or not,
 * and anything locked says what it is waiting on by name.
 */
export function PhaseItemList({
  phase,
  nextItemId,
  expandedItemId,
  linkHighlight = null,
  onToggle,
  onPrimary,
  renderExpanded,
}: Props) {
  const items = orderedPhaseItems(phase);

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
        This phase has nothing in it yet.
      </div>
    );
  }

  return (
    <ol className="space-y-2" aria-label={`${phase.title}: steps and questions`}>
      {items.map((item) => {
        const state = itemState(item, phase.locked);
        const isNext = item.id === nextItemId;
        const isExpanded = item.id === expandedItemId;
        const isQuestion = item.kind === "question";
        const action = primaryActionLabel(item, state);
        const blockers = state === "locked" ? waitingOn(item, items) : [];
        const minutes = item.kind === "step" ? item.step.estimatedMinutes : null;
        const muted = state === "done" || state === "skipped" || state === "locked";
        const canUnfold = state !== "locked";
        const isLinked = linkHighlight?.id === item.id;

        return (
          <li
            key={isLinked ? `${item.id}:${linkHighlight.key}` : item.id}
            id={linkedCardId(item.id)}
            data-item-id={item.id}
            className={`overflow-hidden rounded-2xl border transition-colors ${isLinked ? "app-link-highlight" : ""}${
              isExpanded
                ? isQuestion
                  ? "border-app-question-border bg-app-surface shadow-lg"
                  : "border-app-brand-border bg-app-surface shadow-lg"
                : isNext
                  ? isQuestion
                    ? "border-app-question-solid bg-app-question-bg/60"
                    : "border-app-brand bg-app-brand-soft/60"
                  : isQuestion
                    ? "border-app-question-border/60 bg-app-question-bg/30 hover:bg-app-question-bg/60"
                    : "border-app-border/70 bg-app-surface/60 hover:bg-app-surface"
            }`}
          >
            <div className="flex items-center gap-3 p-3 pr-4">
              <button
                type="button"
                onClick={() => canUnfold && onToggle(item)}
                aria-expanded={canUnfold ? isExpanded : undefined}
                disabled={!canUnfold}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-default"
              >
                <ItemGlyph item={item} state={state} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isNext && !isExpanded ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase ${
                          isQuestion ? "bg-app-question-solid" : "bg-app-brand"
                        }`}
                      >
                        Up next
                      </span>
                    ) : null}
                    <span
                      className={`text-sm font-semibold ${
                        state === "done" || state === "skipped"
                          ? "text-app-text-subtle line-through decoration-app-text-subtle/40"
                          : muted
                            ? "text-app-text-muted"
                            : "text-app-text"
                      }`}
                    >
                      {isQuestion ? item.question.question : item.title}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-text-subtle">
                    {isQuestion ? (
                      <span className="rounded-full bg-app-question-solid/15 px-2 py-px font-semibold text-app-question-text">
                        Question · {itemKindLabel(item)}
                      </span>
                    ) : (
                      <span>{itemKindLabel(item)}</span>
                    )}
                    {minutes ? <span>{formatMinutes(minutes)}</span> : null}
                    <span className={state === "retry" ? "font-medium text-app-warning-text" : ""}>
                      {itemStateLabel[state]}
                    </span>
                    <ItemFlags item={item} inline showUpdates />
                    {blockers.length > 0 ? (
                      <span className="text-app-text-muted">
                        Waits on{" "}
                        {blockers.map((blocker, index) => (
                          <span key={blocker.id}>
                            {index > 0 ? ", " : ""}
                            <span className="font-medium text-app-text">{blocker.title}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>

              {action && !isExpanded ? (
                <Button
                  size="sm"
                  variant={isNext ? "primary" : "secondary"}
                  onClick={() => onPrimary(item)}
                  trailingIcon={<ChevronRight className="h-4 w-4" />}
                >
                  {action}
                </Button>
              ) : canUnfold ? (
                <button
                  type="button"
                  onClick={() => onToggle(item)}
                  aria-label={isExpanded ? `Fold ${item.title}` : `Open ${item.title}`}
                  className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>

            {isExpanded ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="border-t border-app-border"
              >
                <div className="p-4 sm:px-5">{renderExpanded(item)}</div>
              </motion.div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
