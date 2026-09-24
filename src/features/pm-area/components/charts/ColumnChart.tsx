import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { ChartDatum } from "./chartTypes";

type ColumnChartProps = {
  data: readonly ChartDatum[];
  /** What the chart shows, for assistive technology — e.g. "Members by time on their step". */
  ariaLabel: string;
  /** Height of the plot, without the labels underneath. */
  height?: number;
  /** Singular and plural of what is counted, for the tooltip: ["member", "members"]. */
  unit?: [string, string];
};

/**
 * Counts per ordered bin as thin columns on one baseline — a distribution at a glance.
 *
 * Plain HTML rather than SVG, so the columns share out whatever width the card has. Columns are
 * capped at 24px and grow from the baseline with a rounded cap; the count sits on the cap of every
 * column that has one, and hovering a column adds its hint (who is in it) in a tooltip above it.
 */
export function ColumnChart({
  data,
  ariaLabel,
  height = 112,
  unit = ["member", "members"],
}: ColumnChartProps) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const highest = Math.max(1, ...data.map((datum) => datum.value));

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={`${ariaLabel}: ${data.map((datum) => `${datum.label} ${datum.value}`).join(", ")}`}
        className="relative flex items-end gap-1 border-b border-app-border"
        style={{ height }}
      >
        {data.map((datum, index) => {
          const share = datum.value / highest;
          const isHovered = hovered === datum.key;

          return (
            <div
              key={datum.key}
              // `pt-5` keeps room above the tallest column for its count.
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end pt-5"
              onMouseEnter={() => setHovered(datum.key)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full z-20 mb-1 w-max max-w-48 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs shadow-lg"
                >
                  <p className="font-semibold text-app-text">
                    {datum.value} {datum.value === 1 ? unit[0] : unit[1]} · {datum.label}
                  </p>
                  {datum.hint && <p className="mt-0.5 text-app-text-muted">{datum.hint}</p>}
                </div>
              )}
              <span
                aria-hidden="true"
                className="relative block w-full max-w-6"
                style={{ height: `${datum.value > 0 ? Math.max(4, share * 100) : 0}%` }}
              >
                {datum.value > 0 && (
                  <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[11px] font-semibold text-app-text tabular-nums">
                    {datum.value}
                  </span>
                )}
                <motion.span
                  className={`block h-full w-full origin-bottom rounded-t bg-current transition-opacity duration-200 ${datum.colorClassName}`}
                  style={{ opacity: hovered && !isHovered ? 0.45 : 1 }}
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: 0.6,
                    delay: 0.05 + index * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-1">
        {data.map((datum) => (
          <span
            key={datum.key}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-app-text-muted"
            title={datum.label}
          >
            {datum.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
