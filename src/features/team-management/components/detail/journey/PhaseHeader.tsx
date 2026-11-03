import { ClipboardCheck, Lock } from "lucide-react";
import type { ReactNode } from "react";
import {
  blockingPhases,
  formatMinutes,
  ItemFlags,
  phaseProgress,
  StepOriginBadge,
  type OnboardingPhaseEndpoint,
  type PhaseItem,
} from "./journeyKit";
import { actualMinutesOf, minutesOverEstimate } from "./journeyRules";

export type StepTaskCount = { total: number; done: number };

type PhaseHeaderProps = {
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  isFocus: boolean;
  firstName: string;
  tools: ReactNode;
};

function QuestionsPassed({ phase }: { phase: OnboardingPhaseEndpoint }) {
  const questions = phase.questions ?? [];
  const passed = questions.filter((question) => question.status === "PASSED").length;

  return (
    <span className="inline-flex items-center gap-1">
      <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {questions.length === 0 ? "No questions" : `${passed}/${questions.length} questions passed`}
    </span>
  );
}

/** The phase's title, how far along it is, what it waits on, and the tools to change it. */
export function PhaseHeader({ phase, phases, isFocus, firstName, tools }: PhaseHeaderProps) {
  const progress = phaseProgress(phase);
  const waitsOn = blockingPhases(phase, phases);

  return (
    <div className="rounded-3xl border border-app-border bg-app-surface p-4 sm:p-5">
      <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
        Phase {phases.indexOf(phase) + 1} of {phases.length}
        {isFocus ? <span className="text-app-brand-text"> · {firstName} is here</span> : null}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-app-text">{phase.title}</h3>
      {phase.description ? (
        <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{phase.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-app-text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-app-border-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end"
              style={{ width: `${progress.percentage}%` }}
            />
          </span>
          <span className="tabular-nums">
            {progress.completed}/{progress.total} done
          </span>
        </span>
        <QuestionsPassed phase={phase} />
        {waitsOn.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Opens for {firstName} after {waitsOn.map((blocker) => blocker.title).join(", ")}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-app-border pt-4">{tools}</div>
    </div>
  );
}

function TookBadge({ actual, delta }: { actual: number; delta: number | null }) {
  const over = delta !== null && delta > 0;

  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        over ? "bg-app-warning-bg text-app-warning-text" : "bg-app-success-bg text-app-success-text"
      }`}
    >
      Took {formatMinutes(actual)}
      {delta ? ` (${delta > 0 ? "+" : "-"}${formatMinutes(Math.abs(delta))})` : ""}
    </span>
  );
}

/** A step's origin, its tasks, how long it took against the estimate, and its flags. */
export function StepFacts({ item, taskCount }: { item: PhaseItem; taskCount?: StepTaskCount }) {
  if (item.kind !== "step") return null;
  const actual = actualMinutesOf(item);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <StepOriginBadge step={item.step} viewer="reviewer" />
      {taskCount ? (
        <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-app-text-muted">
          {taskCount.done}/{taskCount.total} tasks
        </span>
      ) : null}
      {actual ? <TookBadge actual={actual} delta={minutesOverEstimate(item)} /> : null}
      <ItemFlags item={item} inline />
    </div>
  );
}
