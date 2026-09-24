import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs";
import { useSwipeableTabs } from "../../../hooks/useHorizontalWheelNavigation";
import {
  AREA_META,
  AREA_ORDER,
  SEVERITY_META,
  SEVERITY_RANK,
  FILTER_ORDER,
  matchesFilter,
  type FindingFilter,
} from "./analysisMeta";
import type { Finding, FindingArea } from "./findings";

type Connector = {
  key: string;
  d: string;
  color: string;
  strong: boolean;
  kind: "area" | "finding";
};

type AnalysisMapProps = {
  findings: readonly Finding[];
  filter: FindingFilter;
  onFilterChange: (filter: FindingFilter) => void;
  selectedArea: FindingArea;
  onSelectArea: (area: FindingArea) => void;
  onOpenFinding: (to: string) => void;
  /** Drawn in the core. */
  core: ReactNode;
};

/** What the map shows for one filter and area: the chosen area's findings, and every area's tally. */
function deriveMap(findings: readonly Finding[], filter: FindingFilter, selectedArea: FindingArea) {
  const visible = findings.filter((finding) => matchesFilter(finding, filter));
  const bySeverity = (a: Finding, b: Finding) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  return {
    shown: visible.filter((finding) => finding.area === selectedArea).sort(bySeverity),
    areaStats: AREA_ORDER.map((area) => {
      const inArea = visible.filter((finding) => finding.area === area).sort(bySeverity);
      return { area, count: inArea.length, worst: inArea[0]?.severity ?? null };
    }),
  };
}

/** A horizontal S-curve from one point to another — the shape every connector here takes. */
function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function FindingRow({ finding, onOpen }: { finding: Finding; onOpen: (to: string) => void }) {
  const severity = SEVERITY_META[finding.severity];
  const SeverityIcon = severity.icon;
  const glowStyle = {
    boxShadow: `inset 3px 0 0 ${severity.glow}, 0 0 28px -14px ${severity.glow}`,
  };
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}
          >
            <SeverityIcon aria-hidden="true" className="h-3 w-3" />
            {severity.label}
          </span>
        </span>
        <span className="mt-1 block text-sm font-semibold text-app-text">{finding.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-app-text-muted">
          {finding.detail}
        </span>
      </span>
      {finding.to && (
        <ArrowUpRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 self-center text-app-text-subtle transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-app-text"
        />
      )}
    </>
  );
  const className =
    "group flex w-full items-start gap-3 rounded-xl border border-app-border-muted bg-app-surface/70 py-3 pr-3 pl-4 text-left backdrop-blur-md";

  return finding.to ? (
    <button
      type="button"
      onClick={() => onOpen(finding.to ?? "")}
      aria-label={`Open: ${finding.title}`}
      style={glowStyle}
      className={`${className} transition-colors hover:border-app-border-strong hover:bg-app-surface focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
    >
      {body}
    </button>
  ) : (
    <div style={glowStyle} className={className}>
      {body}
    </div>
  );
}

/**
 * The results as a map: the project as a core on the left, every area as a card beside it, and
 * the chosen area's findings fanning out on the right — each tied back to its area by a luminous
 * curve that lights up in the finding's severity.
 *
 * The same reading as a list — which area, how bad, what exactly — laid out so that where the
 * trouble sits is seen before it is read. Every card is a button: an area card chooses the area,
 * a finding card opens where it can be acted on. The filter above the findings (to look at, going
 * well, all) also follows a two-finger swipe over the map, like every other tab bar in the app.
 *
 * The curves are measured off the rendered cards, so they follow the layout at any width; on a
 * phone, where the three columns stack, they are left out.
 */
export function AnalysisMap({
  findings,
  filter,
  onFilterChange,
  selectedArea,
  onSelectArea,
  onOpenFinding,
  core,
}: AnalysisMapProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<{ w: number; h: number; lines: Connector[] }>({
    w: 0,
    h: 0,
    lines: [],
  });

  const swipeRef = useSwipeableTabs<FindingFilter, HTMLDivElement>({
    order: FILTER_ORDER,
    value: filter,
    onChange: onFilterChange,
    // Inside a dialog, which opts the page's own swipe out: this one owns its own area.
    boundary: "self",
  });
  const setContainer = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      swipeRef(node);
    },
    [swipeRef],
  );

  const { shown, areaStats } = deriveMap(findings, filter, selectedArea);

  const measure = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const base = box.getBoundingClientRect();
    const anchor = (name: string) => box.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
    const rect = (element: HTMLElement | null) => {
      const r = element?.getBoundingClientRect();
      return r && r.width > 0 ? r : null;
    };

    const { shown: fanned, areaStats: areas } = deriveMap(findings, filter, selectedArea);
    const lines: Connector[] = [];
    const coreRect = rect(anchor("core"));
    if (coreRect) {
      const cx = coreRect.right - base.left;
      const cy = coreRect.top + coreRect.height / 2 - base.top;
      for (const { area, worst } of areas) {
        const areaRect = rect(anchor(`area-${area}`));
        if (!areaRect) continue;
        lines.push({
          key: `core-${area}`,
          kind: "area",
          d: curve(
            cx,
            cy,
            areaRect.left - base.left,
            areaRect.top + areaRect.height / 2 - base.top,
          ),
          color: worst ? SEVERITY_META[worst].glow : "var(--border-muted)",
          strong: area === selectedArea,
        });
      }
    }

    const fromRect = rect(anchor(`area-${selectedArea}`));
    if (fromRect) {
      const fx = fromRect.right - base.left;
      const fy = fromRect.top + fromRect.height / 2 - base.top;
      for (const finding of fanned) {
        const toRect = rect(anchor(`finding-${finding.id}`));
        if (!toRect) continue;
        lines.push({
          key: `${selectedArea}-${filter}-${finding.id}`,
          kind: "finding",
          d: curve(fx, fy, toRect.left - base.left, toRect.top + toRect.height / 2 - base.top),
          color: SEVERITY_META[finding.severity].glow,
          strong: true,
        });
      }
    }

    setLayout({ w: base.width, h: base.height, lines });
  }, [findings, filter, selectedArea]);

  useLayoutEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const frame = window.requestAnimationFrame(measure);
    // Measured again once the dialog's entrance and the cards' fade have settled: those move the
    // cards by transform, which no resize observer hears, and a curve measured mid-animation ends
    // in mid-air.
    const settles = [250, 600].map((delay) => window.setTimeout(measure, delay));
    const observer = new ResizeObserver(() => measure());
    observer.observe(box);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      settles.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const selectedMeta = AREA_META[selectedArea];

  return (
    <div ref={setContainer} className="relative">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block"
        width={layout.w}
        height={layout.h}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {layout.lines.map((line, index) =>
          line.kind === "area" ? (
            <path
              key={line.key}
              d={line.d}
              fill="none"
              strokeLinecap="round"
              strokeWidth={line.strong ? 2 : 1.2}
              style={{ stroke: line.color }}
              opacity={line.strong ? 0.9 : 0.35}
              filter={line.strong ? `url(#${uid}-glow)` : undefined}
            />
          ) : (
            <g key={line.key}>
              <motion.path
                d={line.d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={1.6}
                style={{ stroke: line.color }}
                opacity={0.85}
                filter={`url(#${uid}-glow)`}
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
              />
              {!reduceMotion && (
                <circle r={2.4} style={{ fill: line.color }} filter={`url(#${uid}-glow)`}>
                  <animateMotion
                    dur="2.4s"
                    begin={`${(index % 5) * 0.35}s`}
                    repeatCount="indefinite"
                    path={line.d}
                  />
                </circle>
              )}
            </g>
          ),
        )}
      </svg>

      <div className="relative grid gap-6 lg:grid-cols-[11rem_14rem_minmax(0,1fr)] lg:items-center lg:gap-x-16">
        {/* The core. */}
        <div className="hidden flex-col items-center gap-3 text-center lg:flex">
          {/* The core, inside the faint rings of its own aura. */}
          <div className="relative flex h-44 w-44 items-center justify-center">
            {[0, 1, 2].map((ring) => (
              <motion.span
                key={ring}
                aria-hidden="true"
                className="absolute rounded-full border border-app-border-muted"
                style={{ inset: ring * 14, opacity: 0.55 - ring * 0.12 }}
                animate={reduceMotion ? undefined : { rotate: ring % 2 ? -360 : 360 }}
                transition={{ duration: 40 + ring * 20, repeat: Infinity, ease: "linear" }}
              />
            ))}
            <span
              aria-hidden="true"
              className="absolute inset-3 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--brand-text) 22%, transparent) 0%, transparent 70%)",
              }}
            />
            <motion.div
              data-anchor="core"
              className="relative flex h-28 w-28 items-center justify-center rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 36% 30%, var(--text) 0%, var(--purple-text) 24%, var(--brand) 64%, var(--bg) 100%)",
                boxShadow:
                  "0 0 40px color-mix(in oklab, var(--brand-text) 45%, transparent), 0 0 110px color-mix(in oklab, var(--purple-text) 25%, transparent)",
              }}
              animate={reduceMotion ? undefined : { scale: [1, 1.035, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          {core}
        </div>

        {/* The areas. */}
        <nav aria-label="Areas" className="flex flex-wrap gap-2 lg:flex-col">
          {areaStats.map(({ area, count, worst }) => {
            const meta = AREA_META[area];
            const Icon = meta.icon;
            const selected = area === selectedArea;
            return (
              <button
                key={area}
                type="button"
                data-anchor={`area-${area}`}
                onClick={() => onSelectArea(area)}
                aria-pressed={selected}
                className={`flex min-w-36 flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none lg:flex-none ${
                  selected
                    ? "border-app-brand-border-strong bg-app-surface"
                    : "border-app-border-muted bg-app-surface/50 hover:bg-app-surface/80"
                }`}
                style={
                  selected
                    ? { boxShadow: `0 0 30px -10px ${meta.glow}, inset 0 0 0 1px ${meta.glow}` }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.chip}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-tight font-bold text-app-text tabular-nums">
                    {count > 0 ? (
                      count
                    ) : (
                      <CheckCircle2
                        aria-label="Nothing here"
                        className="h-4 w-4 text-app-success-text"
                      />
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-app-text-muted">
                    {meta.label}
                  </span>
                </span>
                {worst && (
                  <span
                    aria-label={SEVERITY_META[worst].label}
                    title={SEVERITY_META[worst].label}
                    role="img"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: SEVERITY_META[worst].glow,
                      boxShadow: `0 0 8px ${SEVERITY_META[worst].glow}`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* The chosen area's findings. */}
        <section aria-label={`${selectedMeta.label} findings`} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-app-text">
              {selectedMeta.label}
              <span className="ml-2 font-normal text-app-text-muted">
                {shown.length === 1 ? "1 finding" : `${shown.length} findings`}
              </span>
            </h3>
            <SegmentedTabs
              value={filter}
              onChange={onFilterChange}
              layoutId="project-analysis-filter"
              ariaLabel="Show findings"
              size="sm"
              options={[
                {
                  value: "act",
                  label: "To look at",
                  count: findings.filter((finding) => matchesFilter(finding, "act")).length,
                },
                {
                  value: "good",
                  label: "Going well",
                  count: findings.filter((finding) => matchesFilter(finding, "good")).length,
                },
                { value: "all", label: "All", count: findings.length },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-app-border-muted px-4 py-6 text-sm text-app-text-muted">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-text" />
              {filter === "good"
                ? `Nothing to report as going well in ${selectedMeta.label.toLowerCase()}.`
                : `Nothing in ${selectedMeta.label.toLowerCase()} needs you.`}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {shown.map((finding, index) => (
                <motion.li
                  key={`${filter}-${finding.id}`}
                  data-anchor={`finding-${finding.id}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.15 + index * 0.06 }}
                >
                  <FindingRow finding={finding} onOpen={onOpenFinding} />
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
