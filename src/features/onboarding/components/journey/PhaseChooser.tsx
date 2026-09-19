import { ArrowRight, CircleHelp, Signpost, SquareCheckBig } from "lucide-react";
import type { OnboardingPhaseEndpoint } from "../../types";

/**
 * The fork in a path: several phases just opened, and the member decides which one comes first.
 *
 * Shown instead of an "up next" card, because at this point there is no single next thing -- and
 * picking one by position would quietly take the decision the blueprint left to the member.
 */
export function PhaseChooser({
  phases,
  allPhases,
  onChoose,
}: {
  phases: OnboardingPhaseEndpoint[];
  allPhases: OnboardingPhaseEndpoint[];
  onChoose: (phaseId: string) => void;
}) {
  return (
    <section
      aria-labelledby="phase-chooser-title"
      className="relative overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface p-5 sm:p-6"
    >
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-app-brand-soft blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-app-brand text-white shadow-[0_10px_30px_-10px_var(--color-app-brand)]">
            <Signpost className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-app-brand-text uppercase">
              Your pick
            </p>
            <h2
              id="phase-chooser-title"
              className="mt-1 text-lg leading-snug font-bold text-app-text sm:text-xl"
            >
              {phases.length} phases are open — where do you want to go next?
            </h2>
            <p className="mt-1 text-sm text-app-text-muted">
              They don’t depend on each other, so any order works. The others stay open.
            </p>
          </div>
        </div>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {phases.map((phase) => {
            const questions = phase.questions?.length ?? 0;
            return (
              <li key={phase.id}>
                <button
                  type="button"
                  onClick={() => onChoose(phase.id)}
                  className="group flex h-full w-full flex-col rounded-2xl border border-app-border bg-app-surface p-4 text-left transition-colors hover:border-app-brand-border hover:bg-app-surface-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                >
                  <span className="text-[11px] font-semibold text-app-text-subtle tabular-nums">
                    Phase {allPhases.indexOf(phase) + 1}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold text-app-text">{phase.title}</span>
                  {phase.description ? (
                    <span className="mt-1 line-clamp-2 text-xs text-app-text-muted">
                      {phase.description}
                    </span>
                  ) : null}
                  <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-app-text-subtle">
                    <span className="inline-flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <SquareCheckBig className="h-3.5 w-3.5" aria-hidden="true" />
                        {phase.steps.length} {phase.steps.length === 1 ? "step" : "steps"}
                      </span>
                      {questions > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                          {questions} {questions === 1 ? "question" : "questions"}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-app-brand-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      Start here
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
