import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, CircleAlert } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconTile, type IconTileTone } from "../../../components/ui/IconTile";
import { AREA_META, AREA_ORDER, SEVERITY_META, SEVERITY_RANK } from "./analysisMeta";
import type { Finding, FindingArea } from "./findings";
import { NeonRing } from "./NeonRing";

/** The area the map is narrowed to, or `null` for none — then every area is shown at once. */
export type MapSelection = FindingArea | null;

type Connector = {
  key: string;
  d: string;
  color: string;
  strong: boolean;
  kind: "area" | "finding";
};

type AnalysisMapProps = {
  findings: readonly Finding[];
  selected: MapSelection;
  onSelect: (selection: MapSelection) => void;
  onOpenFinding: (to: string) => void;
  /** The health score, lit round the ring in the core; `null` for an incomplete run. */
  score: number | null;
  /** The colour the ring's arc ends in. */
  scoreAccent: string;
  /** Words under the ring. */
  caption: ReactNode;
  /**
   * The areas whose check could not run. They have no findings, and that must not read as
   * "nothing here": their cards say they were not checked.
   */
  failedAreas?: readonly FindingArea[];
};

const bySeverity = (a: Finding, b: Finding) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];

/** Most pressing first; within a severity, in the order the areas are drawn. */
const byImportance = (a: Finding, b: Finding) =>
  bySeverity(a, b) || AREA_ORDER.indexOf(a.area) - AREA_ORDER.indexOf(b.area);

/**
 * What the map shows for one selection: the findings (one area's, or every area's in one list),
 * most pressing first, and every area's tally.
 */
function deriveMap(findings: readonly Finding[], selected: MapSelection) {
  const visible = findings;
  const shown =
    selected === null
      ? [...visible].sort(byImportance)
      : visible.filter((finding) => finding.area === selected).sort(bySeverity);
  return {
    visible,
    shown,
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

function FindingRow({
  finding,
  onOpen,
  showArea = false,
}: {
  finding: Finding;
  onOpen: (to: string) => void;
  /** Names the finding's area — needed in the all-areas list, where nothing else says it. */
  showArea?: boolean;
}) {
  const severity = SEVERITY_META[finding.severity];
  const SeverityIcon = severity.icon;
  const area = AREA_META[finding.area];
  const AreaIcon = area.icon;
  const glowStyle = {
    boxShadow: `inset 3px 0 0 ${severity.glow}, 0 0 28px -14px ${severity.glow}`,
  };
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${severity.badge}`}
          >
            <SeverityIcon aria-hidden="true" className="h-3 w-3" />
            {severity.label}
          </span>
          {showArea && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${area.chip}`}
            >
              <AreaIcon aria-hidden="true" className="h-3 w-3" />
              {area.label}
            </span>
          )}
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
      className={`${className} transition-colors hover:border-app-border-strong hover:bg-app-surface`}
    >
      {body}
    </button>
  ) : (
    <div style={glowStyle} className={className}>
      {body}
    </div>
  );
}

function AreaCard({
  anchor,
  icon: Icon,
  tone,
  glow,
  label,
  count,
  worst,
  failed,
  selected,
  onClick,
}: {
  anchor: string;
  icon: typeof CheckCircle2;
  tone: IconTileTone;
  glow: string;
  label: string;
  count: number;
  worst: Finding["severity"] | null;
  /** The area's check could not run. */
  failed: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const WorstIcon = worst ? SEVERITY_META[worst].icon : null;

  return (
    <button
      type="button"
      data-anchor={anchor}
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-w-36 flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left backdrop-blur-md transition-colors lg:flex-none ${
        selected
          ? "border-app-brand-border-strong bg-app-surface"
          : "border-app-border-muted bg-app-surface/50 hover:bg-app-surface/80"
      }`}
      style={
        selected ? { boxShadow: `0 0 30px -10px ${glow}, inset 0 0 0 1px ${glow}` } : undefined
      }
    >
      <IconTile icon={Icon} size="md" tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-tight font-bold text-app-text tabular-nums">
          {failed ? (
            <CircleAlert
              aria-label="Could not be checked"
              className="h-4 w-4 text-app-warning-text"
            />
          ) : count > 0 ? (
            count
          ) : (
            <CheckCircle2 aria-label="Nothing here" className="h-4 w-4 text-app-success-text" />
          )}
        </span>
        <span className="block truncate text-xs text-app-text-muted">{label}</span>
      </span>
      {worst && (
        // The area's worst finding, as the icon and the words of its severity -- the colour alone
        // was a dot, and a dot is only a colour.
        <span
          aria-label={SEVERITY_META[worst].label}
          title={SEVERITY_META[worst].label}
          role="img"
          className={`shrink-0 ${SEVERITY_META[worst].text}`}
        >
          {WorstIcon && <WorstIcon aria-hidden="true" className="h-4 w-4" />}
        </span>
      )}
    </button>
  );
}

/**
 * The results as a map: the project as a ring of light on the left (lit as far as its health
 * reaches), every area as a card beside it, and the findings fanning out on the right — each tied
 * back to its area by a luminous curve in the finding's severity.
 *
 * With no area chosen — how it opens — every finding is there at once in one list, most pressing
 * first whatever its area, each naming its area; the whole picture needs no choosing. Picking an
 * area narrows the list to that area and fans its findings out from the card; picking it again
 * lets go of it. Every card is a button. There is no filter on top: what is going well sits at
 * the end.
 *
 * The curves are measured off the rendered cards, so they follow the layout at any width; on a
 * phone, where the three columns stack, they are left out.
 */
export function AnalysisMap({
  findings,
  selected,
  onSelect,
  onOpenFinding,
  score,
  scoreAccent,
  caption,
  failedAreas = [],
}: AnalysisMapProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<{ w: number; h: number; lines: Connector[] }>({
    w: 0,
    h: 0,
    lines: [],
  });

  const { shown, areaStats } = deriveMap(findings, selected);

  const measure = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const base = box.getBoundingClientRect();
    const anchor = (name: string) => box.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
    const rect = (element: HTMLElement | null) => {
      const r = element?.getBoundingClientRect();
      return r && r.width > 0 ? r : null;
    };
    const leftMid = (r: DOMRect) => [r.left - base.left, r.top + r.height / 2 - base.top] as const;
    const rightMid = (r: DOMRect) =>
      [r.right - base.left, r.top + r.height / 2 - base.top] as const;

    const { shown: fanned, areaStats: areas } = deriveMap(findings, selected);
    const lines: Connector[] = [];

    const coreRect = rect(anchor("core"));
    if (coreRect) {
      const [cx, cy] = rightMid(coreRect);
      for (const { area, worst } of areas) {
        const areaRect = rect(anchor(`area-${area}`));
        if (!areaRect) continue;
        const [ax, ay] = leftMid(areaRect);
        lines.push({
          key: `core-${area}`,
          kind: "area",
          d: curve(cx, cy, ax, ay),
          color: worst ? SEVERITY_META[worst].glow : "var(--border-muted)",
          strong: worst !== null && (selected === null || area === selected),
        });
      }
    }

    // With no area chosen the list is ordered by importance, not by area, so the areas' findings
    // are interleaved: a curve from each area to each of its findings would cross every other
    // one. The core's curves to the areas carry the picture there; the finding curves come with
    // a chosen area.
    if (selected !== null) {
      for (const finding of fanned) {
        const fromRect = rect(anchor(`area-${finding.area}`));
        const toRect = rect(anchor(`finding-${finding.id}`));
        if (!fromRect || !toRect) continue;
        const [fx, fy] = rightMid(fromRect);
        const [tx, ty] = leftMid(toRect);
        lines.push({
          key: `${selected}-${finding.id}`,
          kind: "finding",
          d: curve(fx, fy, tx, ty),
          color: SEVERITY_META[finding.severity].glow,
          strong: true,
        });
      }
    }

    setLayout({ w: base.width, h: base.height, lines });
  }, [findings, selected]);

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
    // The core is sticky inside the dialog's scrolling body, so a scroll moves one end of its
    // curves; captured, since the scroll happens on an ancestor rather than on the window.
    document.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      settles.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const heading = selected === null ? "All areas" : AREA_META[selected].label;

  return (
    <div ref={containerRef} className="relative">
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
              strokeWidth={line.strong ? 1.8 : 1.1}
              style={{ stroke: line.color }}
              opacity={line.strong ? 0.8 : 0.3}
              filter={line.strong ? `url(#${uid}-glow)` : undefined}
            />
          ) : (
            <g key={line.key}>
              <motion.path
                d={line.d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={1.4}
                style={{ stroke: line.color }}
                opacity={0.75}
                filter={`url(#${uid}-glow)`}
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.7, delay: index * 0.025, ease: [0.22, 1, 0.36, 1] }}
              />
              {!reduceMotion && (
                <circle r={2.2} style={{ fill: line.color }} filter={`url(#${uid}-glow)`}>
                  <animateMotion
                    dur="2.6s"
                    begin={`${(index % 7) * 0.33}s`}
                    repeatCount="indefinite"
                    path={line.d}
                  />
                </circle>
              )}
            </g>
          ),
        )}
      </svg>

      <div className="relative grid gap-6 lg:grid-cols-[12rem_14rem_minmax(0,1fr)] lg:gap-x-14">
        {/* The core: a ring lit as far as the project's health reaches. Sticky, so it stays in
            view beside a long all-areas list. */}
        <div className="hidden lg:block">
          <div className="sticky top-0 flex flex-col items-center gap-3 pt-6 text-center">
            <div data-anchor="core">
              {/* An incomplete run has no score: the ring stays dark rather than lit to a number
                  that would count the checks that could not run as clean. */}
              <NeonRing value={score ?? 0} size={180} accent={scoreAccent}>
                <span className="text-4xl leading-none font-bold text-app-text">
                  {score ?? "—"}
                </span>
                <span className="mt-1 text-2xs font-medium tracking-wider text-app-text-muted uppercase">
                  {score === null ? "no score" : "of 100"}
                </span>
              </NeonRing>
            </div>
            {caption}
          </div>
        </div>

        {/* The areas. */}
        <nav aria-label="Areas" className="flex flex-wrap gap-2 lg:flex-col lg:pt-6">
          {areaStats.map(({ area, count, worst }) => {
            const meta = AREA_META[area];
            return (
              <AreaCard
                key={area}
                anchor={`area-${area}`}
                icon={meta.icon}
                tone={meta.tone}
                glow={meta.glow}
                label={meta.label}
                count={count}
                worst={worst}
                failed={failedAreas.includes(area)}
                selected={selected === area}
                // Choosing the area already shown lets go of it, back to every area at once.
                onClick={() => onSelect(selected === area ? null : area)}
              />
            );
          })}
        </nav>

        {/* The findings. */}
        <section aria-label={`${heading} findings`} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-app-text">
              {heading}
              <span className="ml-2 font-normal text-app-text-muted">
                {shown.length === 1 ? "1 finding" : `${shown.length} findings`}
              </span>
            </h3>
          </div>

          {shown.length === 0 && selected !== null && failedAreas.includes(selected) ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-app-warning-border px-4 py-6 text-sm text-app-text-muted">
              <CircleAlert aria-hidden="true" className="h-4 w-4 text-app-warning-text" />
              This check could not run, so there is nothing to report from it — not nothing wrong.
            </p>
          ) : shown.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-app-border-muted px-4 py-6 text-sm text-app-text-muted">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-text" />
              {`Nothing${selected === null ? "" : ` in ${heading.toLowerCase()}`} to report.`}
            </p>
          ) : selected === null ? (
            <ul className="space-y-2">
              {shown.map((finding, index) => (
                <motion.li
                  key={`all-${finding.id}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 + Math.min(index, 12) * 0.04 }}
                >
                  <FindingRow finding={finding} onOpen={onOpenFinding} showArea />
                </motion.li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {shown.map((finding, index) => (
                <motion.li
                  key={`${selected}-${finding.id}`}
                  data-anchor={`finding-${finding.id}`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 + Math.min(index, 12) * 0.04 }}
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
