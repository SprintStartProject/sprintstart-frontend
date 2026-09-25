import { CheckCircle2, CircleDashed, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DinoGame } from "../../../chatbot/components/DinoGame";
import { useDinoUnlocked, useSpaceOpensDino } from "../../../easter-eggs/hooks/useDinoWaitingGame";
import type { GenerationPhaseProgress } from "../../generation/OnboardingJourneyContext";

/**
 * The phases as they stand once the generation has finished.
 *
 * The screen can outlive the run (it stays up while the dino game is still open), and the stage
 * events it was showing may never have reported their last phase as done -- so a finished path
 * would otherwise sit under "Path ready" with a phase still spinning. Failed phases stay failed.
 */
function settle(phases: GenerationPhaseProgress[]): GenerationPhaseProgress[] {
  return phases.map((phase) =>
    phase.state === "working" || phase.state === "waiting" ? { ...phase, state: "done" } : phase,
  );
}

function elapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}

/**
 * What the hire watches while their path is put together: every phase as its own card that fills
 * in as the AI assembles it, rather than one line of text that changes too fast to read.
 *
 * Says plainly that it keeps going elsewhere, because it now does -- the generation runs in the
 * background, and the sidebar and a toast say when it is done.
 */
export function GenerationScreen({
  phases,
  startedAt,
  isRunning,
  isCompleted = false,
  onGameActiveChange,
}: {
  phases: GenerationPhaseProgress[];
  startedAt: number;
  /**
   * The generation request is still in flight (`generation.status === "running"`). The only
   * source of "still generating": the phases are built incrementally from stage events and can
   * all read done/idle while the path is still being persisted or between two phases.
   */
  isRunning: boolean;
  /** The generation finished with a path: every phase reads as done and the clock stops. */
  isCompleted?: boolean;
  /** Reports the dino game opening/closing, so the page can keep this screen up while it is played. */
  onGameActiveChange?: (active: boolean) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const dinoUnlocked = useDinoUnlocked();

  // From the run's status, never from the phases: they are presentational only, and reading them
  // here let an open game claim "Path ready" (and the clock stop) before the run had finished.
  const isGenerating = isRunning && !isCompleted;
  const shownPhases = isCompleted ? settle(phases) : phases;

  const [gameActive, closeGame] = useSpaceOpensDino(isGenerating, dinoUnlocked, {
    keepActiveUntilExit: true,
  });

  useEffect(() => {
    onGameActiveChange?.(gameActive);
  }, [gameActive, onGameActiveChange]);

  // The elapsed clock only runs while something is still being assembled; a finished run must not
  // keep counting up behind the game.
  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const done = shownPhases.filter(
    (phase) => phase.state === "done" || phase.state === "failed",
  ).length;
  const total = shownPhases.length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="app-page-content flex min-h-screen flex-col items-center justify-center py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-app-brand/20 motion-safe:animate-ping" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-app-brand text-white shadow-[0_12px_40px_-12px_var(--color-app-brand)]">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </span>
          </span>
          <h1 className="mt-6 text-2xl font-bold text-app-text sm:text-3xl">
            Building your onboarding path
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-app-text-muted">
            Each phase is put together from your project’s knowledge base. This keeps running in the
            background — feel free to{" "}
            <Link
              to="/"
              className="font-medium text-app-brand-text underline-offset-2 hover:underline"
            >
              look around
            </Link>
            , we’ll let you know when it’s ready.
          </p>
        </div>

        <div
          className="mt-8 rounded-3xl border border-app-border bg-app-surface p-5 sm:p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold text-app-text">
              {total > 0 ? `${done} of ${total} phases assembled` : "Starting up…"}
            </span>
            <span className="text-app-text-subtle tabular-nums" data-testid="generation-elapsed">
              {elapsed(startedAt, now)}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-app-border-muted">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-app-brand to-app-progress-fill-end transition-[width] duration-700 ${
                total === 0 ? "w-1/4 motion-safe:animate-pulse" : ""
              }`}
              style={total > 0 ? { width: `${Math.max(4, percentage)}%` } : undefined}
            />
          </div>

          {total > 0 ? (
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {shownPhases.map((phase) => (
                <li
                  key={phase.name}
                  data-testid="generation-phase"
                  data-state={phase.state}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors duration-500 ${
                    phase.state === "done"
                      ? "border-app-success-border bg-app-success-bg/40"
                      : phase.state === "failed"
                        ? "border-app-warning-border bg-app-warning-bg/40"
                        : phase.state === "working"
                          ? "border-app-brand-border bg-app-brand-soft/50"
                          : "border-app-border bg-app-surface-muted"
                  }`}
                >
                  <span className="shrink-0" aria-hidden="true">
                    {phase.state === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-app-success-text" />
                    ) : phase.state === "failed" ? (
                      <TriangleAlert className="h-4 w-4 text-app-warning-text" />
                    ) : phase.state === "working" ? (
                      <Loader2 className="h-4 w-4 text-app-brand motion-safe:animate-spin" />
                    ) : (
                      <CircleDashed className="h-4 w-4 text-app-text-subtle" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-app-text">
                      {phase.name}
                    </span>
                    <span className="block truncate text-xs text-app-text-subtle">
                      {phase.state === "done"
                        ? "Ready"
                        : phase.state === "waiting"
                          ? "Queued"
                          : phase.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {dinoUnlocked && !gameActive && isGenerating && (
          <p className="mt-4 text-center text-xs text-app-text-subtle">
            Press{" "}
            <kbd className="rounded border border-app-border bg-app-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-app-text shadow-2xs">
              Space
            </kbd>{" "}
            to pass the time 🦖
          </p>
        )}

        {gameActive ? (
          <div className="mt-6">
            <DinoGame
              onExit={closeGame}
              replyReady={!isGenerating && gameActive}
              completionLabel="Path ready"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
