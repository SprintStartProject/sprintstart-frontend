import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { chartTotal, formatShare, type ChartDatum } from "./chartTypes";

type DonutChartProps = {
  data: readonly ChartDatum[];
  /** What the whole chart shows, for assistive technology — e.g. "Team by onboarding stage". */
  ariaLabel: string;
  /** Shown in the hole while nothing is hovered: usually the total or a headline figure. */
  center: ReactNode;
  size?: number;
  thickness?: number;
  /** Legend beside the ring (wide cards) or under it (narrow ones). */
  legend?: "side" | "below";
};

/** The surface-coloured gap between two slices, in px of arc. */
const GAP = 2;

/**
 * A part-to-whole ring with its legend, for at most a handful of categories.
 *
 * The legend always carries every category's name and count, so nothing depends on telling the
 * colours apart; hovering a slice or its legend row lifts that one and puts its figure in the
 * hole instead of in a floating tooltip that would cover the ring. Categories with a count of zero
 * stay in the legend (a "0 done" is information) but draw no slice.
 */
export function DonutChart({
  data,
  ariaLabel,
  center,
  size = 132,
  thickness = 14,
  legend = "side",
}: DonutChartProps) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  const total = chartTotal(data);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const drawn = data.filter((datum) => datum.value > 0);
  const gap = drawn.length > 1 ? GAP : 0;

  // Each slice starts where the ones before it end.
  const slices = drawn.map((datum, index) => {
    const before = drawn
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
    const length = (datum.value / total) * circumference;
    return { datum, dash: Math.max(0, length - gap), offset: before };
  });

  const activeDatum = data.find((datum) => datum.key === active) ?? null;

  return (
    <div
      className={`flex gap-4 ${legend === "side" ? "flex-col items-center sm:flex-row" : "flex-col items-center"}`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${ariaLabel}: ${data.map((datum) => `${datum.value} ${datum.label}`).join(", ")}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="stroke-app-progress-track"
          />
          {slices.map(({ datum, dash, offset: sliceOffset }, index) => (
            <motion.circle
              key={datum.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              strokeDashoffset={-sliceOffset}
              className={`${datum.colorClassName} cursor-default transition-opacity duration-200`}
              style={{ opacity: active && active !== datum.key ? 0.3 : 1 }}
              initial={reduceMotion ? false : { strokeDasharray: `0 ${circumference.toFixed(2)}` }}
              animate={{
                strokeDasharray: `${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}`,
              }}
              transition={{ duration: 0.8, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setActive(datum.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        >
          {activeDatum ? (
            <>
              <span className="text-2xl leading-none font-bold text-app-text">
                {activeDatum.value}
              </span>
              <span className="mt-1 max-w-[70%] truncate text-[11px] text-app-text-muted">
                {activeDatum.label} · {formatShare(activeDatum.value, total)}
              </span>
            </>
          ) : (
            center
          )}
        </div>
      </div>

      <ul className="min-w-0 space-y-1.5 self-stretch sm:self-center">
        {data.map((datum) => (
          <li
            key={datum.key}
            onMouseEnter={() => setActive(datum.key)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-2 rounded-lg px-1.5 py-0.5 text-xs transition-colors ${
              active === datum.key ? "bg-app-surface-hover" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${datum.colorClassName}`}
            />
            <span className="min-w-0 flex-1 truncate text-app-text-muted">{datum.label}</span>
            <span className="shrink-0 font-semibold text-app-text tabular-nums">{datum.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
