import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { formatShare } from "./chartTypes";

export type FunnelStage = {
  key: string;
  label: string;
  /** How many reached this stage. */
  value: number;
  icon?: LucideIcon;
};

type FunnelChartProps = {
  stages: readonly FunnelStage[];
  ariaLabel: string;
  /** A `text-app-*` utility for the bars — one hue, since the stages are one series. */
  colorClassName: string;
};

/**
 * How many made it how far: one bar per stage, each measured against the first.
 *
 * One hue throughout — the stages are steps of one journey, not categories to tell apart — with
 * the count and its share of the first stage at the end of every bar, so the drop between two
 * stages reads straight off the numbers.
 */
export function FunnelChart({ stages, ariaLabel, colorClassName }: FunnelChartProps) {
  const reduceMotion = useReducedMotion();
  const base = Math.max(1, stages[0]?.value ?? 0);

  return (
    <ol aria-label={ariaLabel} className="space-y-2">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const width = (stage.value / base) * 100;

        return (
          <li
            key={stage.key}
            className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
              {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{stage.label}</span>
            </span>
            <span
              aria-hidden="true"
              className="block h-2.5 overflow-hidden rounded-full bg-app-progress-track"
            >
              <motion.span
                className={`block h-full origin-left rounded-full bg-current ${colorClassName}`}
                style={{ width: `${width}%` }}
                initial={reduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
            <span className="w-16 text-right text-xs tabular-nums">
              <span className="font-semibold text-app-text">{stage.value}</span>
              {index > 0 && (
                <span className="ml-1 text-app-text-subtle">{formatShare(stage.value, base)}</span>
              )}
              <span className="sr-only"> reached {stage.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
