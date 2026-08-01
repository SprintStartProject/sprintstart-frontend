import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SectionKey } from "../types.ts";
import {
  dockMagnifySpringToken,
  slidingIndicatorSpringToken,
} from "../../../styles/tokens.ts";

/** Scale applied to the tab under the pointer, mirroring the sidebar dock. */
const TAB_HOVER_SCALE = 1.06;

type SectionOption = {
  key: SectionKey;
  label: string;
  count?: number;
};

type DataIngestionSectionFilterProps = {
  active: SectionKey;
  onChange: (section: SectionKey) => void;
  sourceCount: number;
  runCount: number;
};

/**
 * Section navigation for the overview-first Data Ingestion page: `Overview` is
 * the dashboard and shows everything (overview + sources + runs); the other two
 * narrow to a single section. Rendered as a group of toggle buttons (state via
 * fill + weight + aria-pressed).
 *
 * Motion mirrors the sidebar so the two navigations feel like one system: the
 * hovered tab magnifies, and the active fill is a single shared element that
 * slides between tabs instead of blinking from one to the next.
 */
export function DataIngestionSectionFilter({
  active,
  onChange,
  sourceCount,
  runCount,
}: DataIngestionSectionFilterProps) {
  const [hoveredKey, setHoveredKey] = useState<SectionKey | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const options: SectionOption[] = [
    { key: "overview", label: "Overview" },
    { key: "sources", label: "Sources", count: sourceCount },
    { key: "runs", label: "Runs", count: runCount },
  ];

  return (
    <div
      role="group"
      aria-label="Filter sections"
      onMouseLeave={() => setHoveredKey(null)}
      // `overflow-x-auto` clips at the padding box, so the 4px of padding is
      // exactly what gives the magnified tab room to grow into.
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-app-border/70 bg-app-bg-soft/70 p-1 backdrop-blur-md"
    >
      {options.map((option) => {
        const isActive = active === option.key;
        const isMagnified = !prefersReducedMotion && hoveredKey === option.key;

        return (
          <motion.button
            key={option.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.key)}
            onHoverStart={() => setHoveredKey(option.key)}
            onHoverEnd={() =>
              setHoveredKey((current) => (current === option.key ? null : current))
            }
            animate={{ scale: isMagnified ? TAB_HOVER_SCALE : 1 }}
            transition={dockMagnifySpringToken}
            className={`group relative inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${
              isActive ? "text-white" : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {isActive ? (
              <motion.span
                aria-hidden="true"
                layoutId="data-ingestion-section-pill"
                transition={
                  prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken
                }
                className="absolute inset-0 rounded-xl bg-app-brand shadow-[0_6px_18px_-8px_var(--color-app-brand)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-xl bg-app-surface opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
              />
            )}

            <span className="relative z-10 leading-none">{option.label}</span>

            {typeof option.count === "number" && (
              // `leading-none` on both the label and the count is what actually
              // centres them: the count's smaller font otherwise brings a
              // smaller line box, so flex centring lands them on different lines.
              <span
                className={`relative z-10 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-app-surface text-app-text-subtle"
                }`}
              >
                {option.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
