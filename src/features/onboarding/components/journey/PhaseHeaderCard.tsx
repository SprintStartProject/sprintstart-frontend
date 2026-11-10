import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { blockingPhases, phaseProgress, phaseState, phasesUnlockedBy } from "../../journey";
import type { OnboardingPhaseEndpoint } from "../../types";

function PhaseLinks({
  label,
  phases,
  onSelect,
}: {
  label: string;
  phases: OnboardingPhaseEndpoint[];
  onSelect: (phaseId: string) => void;
}) {
  if (phases.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-app-text-subtle">{label}</span>
      {phases.map((phase) => (
        <button
          key={phase.id}
          type="button"
          onClick={() => onSelect(phase.id)}
          className="inline-flex items-center gap-1 rounded-full border border-app-border px-2.5 py-1 font-medium text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-text"
        >
          {phase.title}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function ProgressBar({ phase }: { phase: OnboardingPhaseEndpoint }) {
  const progress = phaseProgress(phase);
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-app-border-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-[width] duration-500"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <span className="text-xs text-app-text-muted tabular-nums">
        {progress.completed}/{progress.total} done
      </span>
    </div>
  );
}

/** What stands over a phase that is not simply open: waiting on others, or finished. */
function PhaseNote({
  phase,
  waitsOn,
}: {
  phase: OnboardingPhaseEndpoint;
  waitsOn: OnboardingPhaseEndpoint[];
}) {
  const state = phaseState(phase);
  if (state === "locked") {
    return (
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-3 py-2.5 text-sm text-app-text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Opens once {waitsOn.map((blocker) => blocker.title).join(" and ")}{" "}
          {waitsOn.length === 1 ? "is" : "are"} complete. You can look around already.
        </span>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-app-success-border bg-app-success-bg px-3 py-2.5 text-sm text-app-success-text">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Phase complete.
      </div>
    );
  }
  return null;
}

type Props = {
  phase: OnboardingPhaseEndpoint;
  phases: OnboardingPhaseEndpoint[];
  isFocus: boolean;
  onSelectPhase: (phaseId: string) => void;
  /**
   * The phase-level way in to the buddy, given whether the phase is empty. A hire who does not know
   * why a phase is here is not helped by any of the buttons below it -- and an empty phase is the
   * case the buddy exists for: its title still says what it was meant to cover. Handed in, because
   * the buddy is another feature's.
   */
  renderBuddy: (isEmpty: boolean) => ReactNode;
};

/** The selected phase: what it is, how far along, and how it hangs together with the others. */
export function PhaseHeaderCard({ phase, phases, isFocus, onSelectPhase, renderBuddy }: Props) {
  const waitsOn = blockingPhases(phase, phases);
  const unlocks = phasesUnlockedBy(phase, phases);
  const isEmpty = phase.steps.length === 0 && phase.questions.length === 0;

  return (
    <div className="rounded-3xl border border-app-border bg-app-surface p-5">
      <p className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
        Phase {phases.indexOf(phase) + 1} of {phases.length}
        {isFocus ? <span className="text-app-brand-text"> · You are here</span> : null}
      </p>
      <h2 id="phase-title" className="mt-1 text-xl font-semibold text-app-text">
        {phase.title}
      </h2>
      {phase.description ? (
        <p className="mt-1 max-w-3xl text-sm text-app-text-muted">{phase.description}</p>
      ) : null}
      {renderBuddy(isEmpty)}
      <ProgressBar phase={phase} />
      <PhaseNote phase={phase} waitsOn={waitsOn} />
      {waitsOn.length > 0 || unlocks.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-app-border pt-3">
          <PhaseLinks label="Waits on" phases={waitsOn} onSelect={onSelectPhase} />
          <PhaseLinks label="Leads to" phases={unlocks} onSelect={onSelectPhase} />
        </div>
      ) : null}
    </div>
  );
}
