import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleDashed, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AREA_META } from "./analysisMeta";
import type { AnalysisLogEntry, AnalysisTask } from "./useProjectAnalysis";

type ScanPanelProps = {
  tasks: readonly AnalysisTask[];
  log: readonly AnalysisLogEntry[];
  /** When the run started, epoch millis. */
  startedAt: number | null;
};

/** How many log lines stay on screen; the rest scroll off the top. */
const LOG_LINES = 7;

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Re-renders a few times a second while something runs, for the clocks. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

/**
 * The words beside the scan: how far it is, what is being checked right now and why it takes a
 * moment, what the finished checks turned up, and a running log of it all.
 *
 * "Checking…" beside seven names said that something was happening, not what. A manager waiting
 * on an AI rescan wants to know that is what they are waiting on — so every running check says
 * what it does, how long it has been at it, and the log keeps the order things happened in.
 */
export function ScanPanel({ tasks, log, startedAt }: ScanPanelProps) {
  const reduceMotion = useReducedMotion();
  const running = tasks.filter((task) => task.status === "running");
  const finished = tasks.filter((task) => task.status !== "pending" && task.status !== "running");
  const pending = tasks.filter((task) => task.status === "pending");
  const now = useNow(running.length > 0 || pending.length > 0);
  const elapsed = startedAt ? now - startedAt : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-5 rounded-2xl border border-app-border-muted bg-app-surface/60 p-5 backdrop-blur-xl"
    >
      <div>
        <div className="flex items-baseline justify-between text-xs text-app-text-muted">
          <span className="font-semibold tracking-widest text-app-brand-text uppercase">
            Analysing
          </span>
          <span className="tabular-nums">
            {finished.length} of {tasks.length} · {seconds(elapsed)}
          </span>
        </div>
        <span
          aria-hidden="true"
          className="mt-2 block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
        >
          <motion.span
            className="block h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end"
            style={{ boxShadow: "0 0 12px var(--brand-text)" }}
            animate={{ width: `${(finished.length / tasks.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </span>
      </div>

      <section aria-label="Now checking">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Now checking
        </p>
        {running.length === 0 ? (
          <p className="text-sm text-app-text-muted">
            {pending.length > 0 ? "Starting…" : "Putting the findings together…"}
          </p>
        ) : (
          // A finished check leaves this list at once — it shows up under "Found so far" in the
          // same moment — while a new one fades in.
          <ul className="space-y-1.5">
            {running.map((task) => {
              const meta = AREA_META[task.id];
              const Icon = meta.icon;
              return (
                <motion.li
                  key={task.id}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-app-border-muted bg-app-surface-muted/60 px-3 py-2"
                  style={{ boxShadow: `inset 3px 0 0 ${meta.glow}` }}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.chip}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-sm font-medium text-app-text">
                      {task.label}
                      <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-app-brand-text tabular-nums">
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        {task.startedAt ? seconds(now - task.startedAt) : ""}
                      </span>
                    </span>
                    {task.activity && (
                      <span className="mt-0.5 block text-xs leading-snug text-app-text-muted">
                        {task.activity}
                      </span>
                    )}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Checks">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Found so far
        </p>
        <ul className="space-y-1">
          {tasks.map((task) => {
            const meta = AREA_META[task.id];
            const settled = task.status !== "pending" && task.status !== "running";
            return (
              <li key={task.id} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    task.status === "failed"
                      ? "bg-app-danger-solid text-app-text"
                      : settled
                        ? "bg-app-success-solid text-app-text"
                        : "text-app-text-subtle"
                  }`}
                >
                  {task.status === "failed" ? (
                    <X className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : settled ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : task.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-app-brand-text" />
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className={settled ? "text-app-text" : "text-app-text-subtle"}>
                  {meta.label}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-right ${task.status === "failed" ? "text-app-danger-text" : "text-app-text-muted"}`}
                  title={task.note}
                >
                  {settled
                    ? `${task.note ?? ""}${task.startedAt && task.finishedAt ? ` · ${seconds(task.finishedAt - task.startedAt)}` : ""}`
                    : task.status === "running"
                      ? "checking…"
                      : "waiting"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Log">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-app-text-muted uppercase">
          Log
        </p>
        <ol className="space-y-1 font-mono text-[11px] leading-relaxed">
          <AnimatePresence initial={false}>
            {log.slice(-LOG_LINES).map((entry) => (
              <motion.li
                key={entry.id}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <span className="shrink-0 text-app-text-subtle tabular-nums">
                  {startedAt ? seconds(entry.at - startedAt).padStart(5, " ") : ""}
                </span>
                <span
                  className={`min-w-0 ${
                    entry.kind === "failed"
                      ? "text-app-danger-text"
                      : entry.kind === "start"
                        ? "text-app-text-muted"
                        : "text-app-text"
                  }`}
                >
                  {entry.kind === "start" ? "→ " : entry.kind === "failed" ? "✕ " : "✓ "}
                  {entry.text}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </section>
    </div>
  );
}
