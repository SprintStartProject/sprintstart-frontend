import { Clock, Plus } from "lucide-react";
import type { ReactNode } from "react";
import {
  formatMinutes,
  itemKindLabel,
  itemState,
  itemStateLabel,
  ItemGlyph,
  ItemKindIcon,
  phaseItems,
  unlockedBy,
  waitingOn,
  type OnboardingPhaseEndpoint,
  type PhaseItem,
} from "./journeyKit";
import { rowTone, stagesOf } from "./journeyRules";
import { StepFacts, type StepTaskCount } from "./PhaseHeader";

type MemberItemListProps = {
  phase: OnboardingPhaseEndpoint;
  nextItemId: string | null;
  stepTaskCounts: Record<string, StepTaskCount>;
  onOpenItem: (item: PhaseItem) => void;
  /** Adds a blank step after an item, or at the end of the phase for null. */
  onAddAfter: (item: PhaseItem | null) => void;
  freshStepId: string | null;
  renderFreshStep: (item: PhaseItem) => ReactNode;
};

function AddAtEnd({ isEmpty, onClick }: { isEmpty: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-app-border px-4 py-3 text-sm font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:bg-app-brand-soft/30 hover:text-app-brand-text"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {isEmpty ? "Add the first step" : "Add a step at the end"}
    </button>
  );
}

function StageHeading({ index, size }: { index: number; size: number }) {
  return (
    <h4 className="relative mb-1.5 -ml-5 flex items-center gap-2 text-2xs font-semibold tracking-wide text-app-text-subtle uppercase">
      <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app-border bg-app-surface text-2xs tabular-nums">
        {index + 1}
      </span>
      {index === 0 ? "First" : "Then"}
      {size > 1 ? (
        <span className="font-normal tracking-normal normal-case">· {size} in any order</span>
      ) : null}
    </h4>
  );
}

/** A phase's items in stages: each opens once the ones above it are done. */
export function MemberItemList({
  phase,
  nextItemId,
  stepTaskCounts,
  onOpenItem,
  onAddAfter,
  freshStepId,
  renderFreshStep,
}: MemberItemListProps) {
  const items = phaseItems(phase);
  const stages = stagesOf(phase);
  const addAtEnd = <AddAtEnd isEmpty={items.length === 0} onClick={() => onAddAfter(null)} />;

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-3xl border border-dashed border-app-border bg-app-surface-muted px-6 py-10 text-center text-sm text-app-text-muted">
          This phase has no steps or questions yet.
        </div>
        {addAtEnd}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages.map((stage, stageIndex) => (
        <section
          key={stage[0].id}
          aria-label={`Stage ${stageIndex + 1}`}
          className="relative pl-5 before:absolute before:top-7 before:bottom-2 before:left-[7px] before:w-px before:bg-app-border"
        >
          <StageHeading index={stageIndex} size={stage.length} />
          <ol className="space-y-1" aria-label={`${phase.title}, stage ${stageIndex + 1}`}>
            {stage.map((item) => (
              <MemberItemRow
                key={item.id}
                item={item}
                items={items}
                phase={phase}
                isNext={item.id === nextItemId}
                taskCount={stepTaskCounts[item.id]}
                onOpen={() => onOpenItem(item)}
                onAddAfter={() => onAddAfter(item)}
                fresh={item.id === freshStepId ? renderFreshStep(item) : null}
              />
            ))}
          </ol>
        </section>
      ))}
      {addAtEnd}
    </div>
  );
}

type MemberItemRowProps = {
  item: PhaseItem;
  items: PhaseItem[];
  phase: OnboardingPhaseEndpoint;
  isNext: boolean;
  taskCount?: StepTaskCount;
  onOpen: () => void;
  onAddAfter: () => void;
  fresh: ReactNode;
};

function ItemMeta({ item, state }: { item: PhaseItem; state: ReturnType<typeof itemState> }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-text-subtle">
      {item.kind === "question" ? (
        <span className="rounded-full bg-app-question-solid/15 px-2 py-px font-semibold text-app-question-text">
          Question · {itemKindLabel(item)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <ItemKindIcon item={item} />
          {itemKindLabel(item)}
        </span>
      )}
      {item.kind === "step" && item.step.estimatedMinutes ? (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {formatMinutes(item.step.estimatedMinutes)}
        </span>
      ) : null}
      <span className="font-medium">{itemStateLabel[state]}</span>
    </span>
  );
}

function ItemTitle({
  item,
  state,
  isNext,
}: {
  item: PhaseItem;
  state: ReturnType<typeof itemState>;
  isNext: boolean;
}) {
  const isQuestion = item.kind === "question";

  return (
    <span className="flex flex-wrap items-center gap-2">
      {isNext ? (
        <span
          className={`rounded-full px-2 py-0.5 text-2xs font-bold tracking-wide text-white uppercase ${
            isQuestion ? "bg-app-question-solid" : "bg-app-brand"
          }`}
        >
          Member is here
        </span>
      ) : null}
      <span
        className={`text-sm font-semibold ${
          state === "done" || state === "skipped" ? "text-app-text-muted" : "text-app-text"
        }`}
      >
        {isQuestion ? item.question.question : item.title}
      </span>
    </span>
  );
}

/** What a step being named waits on and leads to, with its form. */
function FreshStep({
  item,
  items,
  children,
}: {
  item: PhaseItem;
  items: PhaseItem[];
  children: ReactNode;
}) {
  const allBlockers = items.filter((candidate) => item.blockerIds.includes(candidate.id));
  const leadsTo = unlockedBy(item, items);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-app-text-muted">
        {allBlockers.length > 0
          ? `Opens after ${allBlockers.map((blocker) => blocker.title).join(", ")}`
          : "Open from the start of the phase"}
        {leadsTo.length > 0 ? ` · leads to ${leadsTo.map((next) => next.title).join(", ")}` : ""}.
        Connections can be changed in the graph.
      </p>
      {children}
    </div>
  );
}

/**
 * In between this row and the next: where a new step goes. Always there, quiet until pointed at:
 * a small "+" on a dashed line, which names itself on hover. Hidden entirely it was too easy to
 * miss that steps can be put in between.
 */
function InsertAfter({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <div className="group/insert relative flex h-5 items-center justify-center">
      <span
        aria-hidden="true"
        className="absolute inset-x-10 top-1/2 border-t border-dashed border-app-border opacity-0 transition-opacity group-focus-within/insert:opacity-100 group-hover/insert:opacity-100"
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={`Add a step after ${title}`}
        title={`Add a step after ${title}`}
        className="relative z-10 inline-flex items-center gap-1 rounded-full border border-app-brand-border bg-app-surface px-1.5 py-0.5 text-xs font-semibold text-app-brand-text shadow-sm transition-all hover:bg-app-brand-soft hover:px-2.5 focus-visible:px-2.5"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        <span className="hidden group-focus-within/insert:inline group-hover/insert:inline">
          Add step here
        </span>
      </button>
    </div>
  );
}

function MemberItemRow({
  item,
  items,
  phase,
  isNext,
  taskCount,
  onOpen,
  onAddAfter,
  fresh,
}: MemberItemRowProps) {
  const state = itemState(item, phase.locked);
  const blockers = waitingOn(item, items);

  return (
    <li className="group/item relative">
      <div
        className={`flex items-start gap-4 rounded-2xl border p-3 transition-colors ${rowTone(
          Boolean(fresh),
          item.kind === "question",
          isNext,
        )}`}
      >
        <span className="mt-0.5">
          <ItemGlyph item={item} state={state} />
        </span>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="w-full rounded-lg text-left">
            <ItemTitle item={item} state={state} isNext={isNext} />
            <ItemMeta item={item} state={state} />
            {item.kind === "step" ? (
              <span className="mt-2 block">
                <StepFacts item={item} taskCount={taskCount} />
              </span>
            ) : null}
            {blockers.length > 0 && state === "locked" ? (
              <span className="mt-1.5 block text-xs text-app-text-muted">
                Waits on {blockers.map((blocker) => blocker.title).join(", ")}
              </span>
            ) : null}
          </button>
          {fresh ? (
            <FreshStep item={item} items={items}>
              {fresh}
            </FreshStep>
          ) : null}
        </div>
      </div>
      <InsertAfter title={item.title} onClick={onAddAfter} />
    </li>
  );
}
