import { CheckCircle2, CircleDashed, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DinoGame } from "../../../chatbot/components/DinoGame";
import type { GenerationPhaseProgress } from "../../generation/OnboardingJourneyContext";

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
}: {
  phases: GenerationPhaseProgress[];
  startedAt: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [gameActive, setGameActive] = useState(false);
  const [dinoUnlocked, setDinoUnlocked] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("dinoUnlocked") === "true",
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Easter egg: Space starts the runner while the path is being generated.
  useEffect(() => {
    const syncUnlock = () => {
      const unlocked = localStorage.getItem("dinoUnlocked") === "true";
      setDinoUnlocked(unlocked);
      if (!unlocked) setGameActive(false);
    };
    window.addEventListener("dinoUnlockChanged", syncUnlock);
    window.addEventListener("storage", syncUnlock);
    return () => {
      window.removeEventListener("dinoUnlockChanged", syncUnlock);
      window.removeEventListener("storage", syncUnlock);
    };
  }, []);

  useEffect(() => {
    if (gameActive || !dinoUnlocked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setGameActive(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameActive, dinoUnlocked]);

  const done = phases.filter((phase) => phase.state === "done" || phase.state === "failed").length;
  const total = phases.length;
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
            <span className="text-app-text-subtle tabular-nums">{elapsed(startedAt, now)}</span>
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
              {phases.map((phase) => (
                <li
                  key={phase.name}
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

        {gameActive ? (
          <div className="mt-6">
            <DinoGame onExit={() => setGameActive(false)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
