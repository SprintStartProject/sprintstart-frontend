import { CheckCircle2, ChevronDown, Lock } from "lucide-react";
import { UpdateDot } from "../../graph/JourneyNodeCards";
import { phaseHasUnseenSkipAnswer } from "../../skipAnswers";
import { useState } from "react";
import { blockingPhases, phaseProgress, phaseState, type PhaseState } from "../../journey";
import { ProgressRing } from "../../graph/JourneyNodeCards";
import { phaseStateLabel } from "../../graph/nodeLabels";
import type { OnboardingPhaseEndpoint } from "../../types";

type Props = {
  phases: OnboardingPhaseEndpoint[];
  selectedPhaseId: string;
  /** The phase the member was last busy in. */
  focusPhaseId: string | null;
  onSelect: (phaseId: string) => void;
  /** Tailwind classes for the sticky offset and height, which depend on the page. */
  className?: string;
  /** Mark phases with news the member has not seen yet -- the hire's view. */
  showUpdates?: boolean;
};

const GROUPS: { state: PhaseState; title: string }[] = [
  { state: "active", title: "In progress" },
  { state: "open", title: "Ready to start" },
  { state: "locked", title: "Coming up" },
  { state: "done", title: "Completed" },
];

function PhaseRow({
  phase,
  index,
  phases,
  selected,
  isFocus,
  hasUpdate,
  onSelect,
}: {
  phase: OnboardingPhaseEndpoint;
  index: number;
  phases: OnboardingPhaseEndpoint[];
  selected: boolean;
  isFocus: boolean;
  hasUpdate: boolean;
  onSelect: () => void;
}) {
  const state = phaseState(phase);
  const progress = phaseProgress(phase);
  const waitsOn = state === "locked" ? blockingPhases(phase, phases) : [];

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={isFocus ? "step" : undefined}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
        selected
          ? "border-app-brand bg-app-brand-soft"
          : "border-transparent hover:border-app-border hover:bg-app-surface-hover"
      }`}
    >
      <ProgressRing
        value={progress.percentage}
        size={34}
        stroke={3.5}
        tone={state === "done" ? "success" : state === "locked" ? "muted" : "brand"}
      >
        {state === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-app-success-text" aria-hidden="true" />
        ) : state === "locked" ? (
          <Lock className="h-3 w-3 text-app-text-subtle" aria-hidden="true" />
        ) : (
          <span className="text-[11px] font-bold text-app-text tabular-nums">{index + 1}</span>
        )}
      </ProgressRing>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            state === "locked" ? "text-app-text-muted" : "text-app-text"
          }`}
        >
          {phase.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-app-text-subtle">
          {hasUpdate ? (
            <span className="font-semibold text-app-brand-text">New answer · </span>
          ) : null}
          {isFocus ? (
            <span className="font-semibold text-app-brand-text">You are here · </span>
          ) : null}
          {waitsOn.length > 0
            ? `After ${waitsOn.map((blocker) => blocker.title).join(", ")}`
            : `${progress.completed}/${progress.total} done`}
        </span>
      </span>
      {hasUpdate ? <UpdateDot className="bg-app-brand" /> : null}
      <span className="sr-only">{phaseStateLabel[state]}</span>
    </button>
  );
}

/**
 * The phases of a path, grouped by where the member stands with them.
 *
 * Grouped rather than listed by number, because phases are not a queue: a blueprint opens several at
 * once, and the member picks. "In progress" and "Ready to start" at the top say exactly that -- these
 * are yours to work on, in any order. What is still locked says what it waits on, and what is done
 * folds away. Below `lg` the whole thing becomes one button that opens the same list.
 */
export function PhaseNavigator({
  phases,
  selectedPhaseId,
  focusPhaseId,
  onSelect,
  className = "",
  showUpdates = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const selectedIndex = phases.findIndex((phase) => phase.id === selectedPhaseId);
  const selected = phases[selectedIndex];
  const done = phases.filter((phase) => phaseState(phase) === "done").length;

  const list = (
    <div className="app-scrollbar relative min-h-0 flex-1 space-y-4 overflow-y-auto p-2">
      {GROUPS.map((group) => {
        const members = phases.filter((phase) => phaseState(phase) === group.state);
        if (members.length === 0) return null;
        const hasUpdate = (phase: OnboardingPhaseEndpoint) =>
          showUpdates && phaseHasUnseenSkipAnswer(phase);
        // Done phases fold away -- unless one is selected or holds news the member has not seen.
        const folded =
          group.state === "done" &&
          !showDone &&
          members.every((p) => p.id !== selectedPhaseId && !hasUpdate(p));
        return (
          <section key={group.state} aria-label={group.title}>
            <div className="flex items-center justify-between px-3 pb-1">
              <h3 className="text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
                {group.title}
                <span className="ml-1.5 font-normal tabular-nums">{members.length}</span>
              </h3>
              {group.state === "done" ? (
                <button
                  type="button"
                  onClick={() => setShowDone((current) => !current)}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                >
                  {folded ? "Show" : "Hide"}
                </button>
              ) : null}
            </div>
            {folded ? null : (
              <div className="space-y-1">
                {members.map((phase) => (
                  <PhaseRow
                    key={phase.id}
                    phase={phase}
                    index={phases.indexOf(phase)}
                    phases={phases}
                    selected={phase.id === selectedPhaseId}
                    isFocus={phase.id === focusPhaseId}
                    hasUpdate={hasUpdate(phase)}
                    onSelect={() => {
                      onSelect(phase.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <nav aria-label="Onboarding phases" className={className}>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
              Phase {selectedIndex + 1} of {phases.length}
            </span>
            <span className="block truncate text-sm font-semibold text-app-text">
              {selected?.title}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {open ? (
          <div className="mt-2 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-xl">
            {list}
          </div>
        ) : null}
      </div>

      <div className="hidden h-full flex-col overflow-hidden rounded-3xl border border-app-border bg-app-surface lg:flex">
        <div className="flex items-baseline justify-between gap-2 border-b border-app-border px-4 py-3">
          <h2 className="text-sm font-semibold text-app-text">Phases</h2>
          <span className="text-xs text-app-text-subtle tabular-nums">
            {done}/{phases.length} complete
          </span>
        </div>
        {list}
      </div>
    </nav>
  );
}
