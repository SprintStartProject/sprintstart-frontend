import { Check, ScanSearch, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AREA_META } from "./analysisMeta";
import type { AnalysisTask } from "./useProjectAnalysis";

const SIZE = 360;
const CENTER = SIZE / 2;
const NODE_RADIUS = 136;
const NODE = 46;

const NODE_STATE: Record<AnalysisTask["status"], string> = {
  pending: "border-app-border bg-app-surface text-app-text-subtle",
  running: "border-app-brand-border-strong bg-app-brand-soft text-app-brand-text",
  done: "border-app-success-border bg-app-success-bg text-app-success-text",
  failed: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  skipped: "border-app-border bg-app-surface-muted text-app-text-muted",
};

type AnalysisOrbProps = {
  tasks: readonly AnalysisTask[];
  /** Still, slowly turning, while nothing runs yet; sweeping while the checks run. */
  active: boolean;
};

/**
 * The analysis, drawn: a core with every check as a node around it, each wired to the core.
 *
 * While a check runs its wire carries a flowing dash and its node pulses; when it is done the wire
 * settles and the node turns green with a tick (red with a cross if it failed). A radar sweep
 * turns behind it all while anything is running. Everything shown here is also in the task list
 * beside it in words, so the picture is decoration for the eye and never the only way to read
 * the state; under reduced motion it stands still.
 */
export function AnalysisOrb({ tasks, active }: AnalysisOrbProps) {
  const reduceMotion = useReducedMotion();
  const done = tasks.filter(
    (task) => task.status !== "pending" && task.status !== "running",
  ).length;
  const nodes = tasks.map((task, index) => {
    const angle = (index / tasks.length) * Math.PI * 2 - Math.PI / 2;
    return {
      task,
      x: CENTER + Math.cos(angle) * NODE_RADIUS,
      y: CENTER + Math.sin(angle) * NODE_RADIUS,
    };
  });

  return (
    <div aria-hidden="true" className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      {/* Rings. */}
      <svg width={SIZE} height={SIZE} className="absolute inset-0">
        {[58, 98, NODE_RADIUS + 34].map((radius) => (
          <circle
            key={radius}
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            strokeWidth={1}
            className="stroke-app-border"
          />
        ))}
        {nodes.map(({ task, x, y }) => {
          const settled = task.status === "done";
          const running = task.status === "running";
          return (
            <motion.line
              key={task.id}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={running ? 2 : 1.5}
              strokeLinecap="round"
              strokeDasharray={running ? "4 7" : undefined}
              className={
                settled
                  ? "text-app-success-solid/60"
                  : running
                    ? "text-app-brand"
                    : task.status === "failed"
                      ? "text-app-danger-solid/60"
                      : "text-app-border"
              }
              animate={running && !reduceMotion ? { strokeDashoffset: [0, -22] } : undefined}
              transition={running ? { duration: 0.6, repeat: Infinity, ease: "linear" } : undefined}
            />
          );
        })}
      </svg>

      {/* The sweep. */}
      {!reduceMotion && (
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: CENTER - (NODE_RADIUS + 34),
            background:
              "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--brand) 28%, transparent) 70deg, transparent 72deg)",
            opacity: active ? 1 : 0.35,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: active ? 2.2 : 9, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* The core. */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: CENTER - 48, top: CENTER - 48, width: 96, height: 96 }}
      >
        {!reduceMotion && active && (
          <motion.span
            className="absolute inset-0 rounded-full bg-app-brand/30"
            animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <motion.span
          className="relative flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-lg"
          animate={active && !reduceMotion ? { scale: [1, 1.04, 1] } : undefined}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ScanSearch className="h-7 w-7" />
          <span className="mt-1 text-xs font-semibold tabular-nums">
            {done}/{tasks.length}
          </span>
        </motion.span>
      </div>

      {/* The checks. */}
      {nodes.map(({ task, x, y }, index) => {
        const Icon = AREA_META[task.id].icon;
        return (
          <motion.div
            key={task.id}
            className="absolute flex flex-col items-center"
            style={{ left: x - NODE / 2, top: y - NODE / 2, width: NODE }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * index, type: "spring", stiffness: 300, damping: 22 }}
          >
            <span
              className={`relative flex items-center justify-center rounded-2xl border-2 shadow-sm transition-colors duration-300 ${NODE_STATE[task.status]}`}
              style={{ width: NODE, height: NODE }}
            >
              {task.status === "running" && !reduceMotion && (
                <motion.span
                  className="absolute -inset-1 rounded-[18px] border-2 border-app-brand"
                  animate={{ opacity: [0.9, 0], scale: [1, 1.25] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <Icon className="h-5 w-5" />
              {(task.status === "done" || task.status === "failed") && (
                <motion.span
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className={`absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-app-surface ${
                    task.status === "done" ? "bg-app-success-solid" : "bg-app-danger-solid"
                  }`}
                >
                  {task.status === "done" ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <X className="h-3 w-3" strokeWidth={3} />
                  )}
                </motion.span>
              )}
            </span>
            <span className="mt-1.5 w-24 text-center text-[11px] leading-tight font-medium text-app-text-muted">
              {AREA_META[task.id].label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
