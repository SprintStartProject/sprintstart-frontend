import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Spinner } from "../../../components/ui/Spinner";
import { useFetch } from "../../../hooks/useFetch";
import { insightsService } from "../../../services/faqService";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import type { FAQGroup } from "../../faq/types";
import type { KnowledgeGap, KnowledgeGapSeverity } from "../../knowledge-gaps/types";
import { SEVERITIES, SEVERITY_ORDER, SEVERITY_STYLES } from "../../knowledge-gaps/severity";
import { useProjectContext } from "../../projects/useProjectContext";
import { summarizeGaps, topQuestions, type GapSummary } from "../teamInsights";
import type { DashboardWidgetSize } from "../layout/types";

const RING_SIZE = 92;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Arc length given up to the gap between two segments.
 *
 * Round caps add half a stroke width at each end, so the visible separation is this minus
 * `RING_STROKE` — a hair over 2px, which is the spacer that keeps neighbouring severities
 * countable without reading as a missing slice.
 */
const SEGMENT_GAP = RING_STROKE + 2.5;

/**
 * Questions listed in the medium form.
 *
 * The cell is a fixed height, so a fourth row does not find more space — it finds the bottom
 * edge.
 */
const VISIBLE_ROW_COUNT = 3;

/**
 * The ring draws straight from the CSS variables rather than the `bg-app-*-solid` classes
 * the bars use, because an SVG `stroke` cannot take a Tailwind background utility. Same
 * values, same theme switch — the variables are redefined in the dark block.
 */
const severityStroke: Record<KnowledgeGapSeverity, string> = {
  high: "var(--danger-solid)",
  medium: "var(--warning-solid)",
  low: "var(--success-solid)",
};

/**
 * Knowledge gaps as a donut: how many components carry a gap in the middle, and how those
 * gaps are split across severities around it.
 *
 * A ring rather than a stacked bar because the question it answers is a proportion — is
 * this mostly low-severity noise, or is a third of it serious. The counts are spelled out
 * in the legend below it, so nothing here depends on telling three colours apart.
 *
 * Animated with a plain CSS transition rather than framer-motion: the test harness only
 * mocks `motion` for a fixed list of HTML tags, so `motion.circle` resolves to undefined
 * there (same reason as the onboarding progress ring).
 */
function GapRing({ summary }: { summary: GapSummary }) {
  const segments = SEVERITIES.filter((severity) => summary.counts[severity] > 0);
  const isSplit = segments.length > 1;

  // Each arc's start is the sum of the ones before it. Folded rather than accumulated in a
  // counter, so nothing mutates while React renders the circles.
  const arcs = segments.reduce<
    { severity: KnowledgeGapSeverity; length: number; offset: number }[]
  >((drawn, severity) => {
    const previous = drawn.at(-1);
    const length = (summary.counts[severity] / summary.total) * RING_CIRCUMFERENCE;

    return [
      ...drawn,
      { severity, length, offset: previous ? previous.offset + previous.length : 0 },
    ];
  }, []);

  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_STROKE}
          stroke="var(--progress-track)"
        />

        {arcs.map(({ severity, length, offset }) => {
          // A single severity fills the whole ring, and trimming it would leave a notch
          // suggesting a second segment that is not there. Anything shorter than the cap
          // still draws as a rounded dot, which is the honest way to show "one of many".
          const drawn = isSplit ? Math.max(length - SEGMENT_GAP, 0.1) : length;
          // Centres the shortened arc in its slice, so the gaps sit between segments
          // rather than all of them drifting clockwise.
          const start = isSplit ? offset + SEGMENT_GAP / 2 : offset;

          return (
            <circle
              key={severity}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              stroke={severityStroke[severity]}
              strokeDasharray={`${drawn} ${RING_CIRCUMFERENCE - drawn}`}
              strokeDashoffset={-start}
              style={{ transition: "stroke-dasharray 900ms ease-out" }}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-app-text tabular-nums">
          {summary.componentCount}
        </span>
        {/*
          Lower case and untracked, unlike the onboarding ring's "done": the hole in a 92px
          ring is 74px across, and "COMPONENTS" set in caps with letter-spacing runs straight
          under the stroke.
        */}
        <span className="text-[10px] leading-none font-medium text-app-text-muted">
          {summary.componentCount === 1 ? "component" : "components"}
        </span>
      </div>
    </div>
  );
}

/**
 * The questions as a bar per group, longest first.
 *
 * The bars are what balance this column against the ring opposite: a list of plain lines
 * would leave one half of the card carrying a chart and the other half carrying text. They
 * also answer something a list cannot — whether one question dominates, or the project asks
 * five different things equally often. Every bar carries its count in figures beside it.
 */
function QuestionBars({ groups, limit }: { groups: readonly FAQGroup[]; limit: number }) {
  const visible = topQuestions(groups, limit);
  const highestCount = visible[0]?.count ?? 0;

  return (
    <ul className="space-y-2.5">
      {visible.map((group) => (
        <li key={group.groupId}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-app-text">{group.question}</span>
            <span className="shrink-0 text-xs font-semibold text-app-text-muted tabular-nums">
              {group.count}
            </span>
          </div>

          <div
            aria-hidden="true"
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-app-surface-muted"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end"
              style={{
                width: `${highestCount > 0 ? (group.count / highestCount) * 100 : 0}%`,
                transition: "width 900ms ease-out",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The components carrying a gap, worst first, with what each is missing.
 *
 * Only shown at full width, and it is the reason full width is worth choosing: the ring says
 * *how much* is undocumented and this says *what*, which is the difference between a figure
 * to worry about and a list to work through. It sits beside the ring rather than in a column
 * of its own, because it is the same analysis read a second way.
 */
function GapList({ gaps }: { gaps: readonly KnowledgeGap[] }) {
  const worstFirst = [...gaps]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, VISIBLE_ROW_COUNT);

  return (
    <ul className="space-y-2">
      {worstFirst.map((gap) => (
        <li key={gap.id} className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
              SEVERITY_STYLES[gap.severity].bar
            }`}
          />

          <div className="min-w-0">
            <p className="truncate text-sm text-app-text">{gap.component}</p>
            <p className="truncate text-xs text-app-text-muted">
              {/* The severity is already in the dot; the words say what would fix it. */}
              {gap.missingTypes.length > 0
                ? `missing ${gap.missingTypes.join(", ")}`
                : SEVERITY_STYLES[gap.severity].longLabel.toLowerCase()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Small uppercase heading with the column's own total on the opposite edge. */
function ColumnHeading({ label, total }: { label: string; total: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-semibold tracking-widest text-app-brand-text uppercase">
        {label}
      </span>
      <span className="text-xs text-app-text-muted tabular-nums">{total}</span>
    </div>
  );
}

/**
 * The team-insights occupant of the dashboard's flexible slot, for PM/HR/Admin.
 *
 * Story #288: a manager should not have to open a second page to find out whether anything
 * is waiting for them. Deliberately not the PM dashboard in miniature — two figures, no
 * lists to work through, no refresh controls — and the whole card leads to the PM dashboard,
 * which is where they can be acted on.
 *
 * The two halves sit side by side rather than stacked, separated by a rule: gaps and
 * questions come from different analyses and one below the other reads as a single story
 * with a subtitle. Each half carries a chart of its own so neither looks like the other's
 * caption.
 *
 * Reads the same endpoints as the PM dashboard's widgets, so the two views can never
 * disagree. Note that both services fall back to their mock fixture when the request fails,
 * so a number here can be fixture data rather than the project's — that fallback lives in
 * `faqService` / `knowledgeGapService`, not in this widget.
 *
 * Which user sees this at all is the dashboard's decision; see {@link canSeeTeamInsights}.
 */
export function TeamInsightsWidget({ size }: { size: DashboardWidgetSize }) {
  const navigate = useNavigate();
  const { selectedProjectId } = useProjectContext();

  const { data: faq, loading: faqLoading } = useFetch(
    () => insightsService.fetchFAQGroups(selectedProjectId),
    [selectedProjectId],
  );

  const { data: knowledgeGaps, loading: gapsLoading } = useFetch(
    () => knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
    [selectedProjectId],
  );

  if (faqLoading || gapsLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl p-6">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  const groups = faq?.groups ?? [];
  const gaps = knowledgeGaps?.gaps ?? [];
  const summary = summarizeGaps(gaps);
  const askedCount = groups.reduce((total, group) => total + group.count, 0);

  const isWide = size === "wide";

  return (
    <ClickableCard
      onClick={() => void navigate("/pm-dashboard")}
      aria-label="Open the PM Dashboard for the full team insights"
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl p-6 transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-app-text">Team insights</span>
        </div>

        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-app-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-app-brand-text"
        >
          Open PM Dashboard
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <div
        className={`relative grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 ${
          isWide ? "lg:grid-cols-2" : ""
        }`}
      >
        <section aria-label="Knowledge gaps">
          <ColumnHeading
            label="Knowledge gaps"
            total={summary.total === 1 ? "1 gap" : `${summary.total} gaps`}
          />

          {/* At full width the ring and the component list sit side by side and close
              together: they are two views of the same analysis, and giving each an equal
              third of the card left the ring stranded in the middle of its own column. */}
          <div className={`flex ${isWide ? "items-center gap-5" : "flex-col items-center gap-3"}`}>
            <div className="flex shrink-0 flex-col items-center gap-2">
              <GapRing summary={summary} />

              {summary.total > 0 && (
                <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  {SEVERITIES.filter((severity) => summary.counts[severity] > 0).map((severity) => (
                    <li
                      key={severity}
                      className="flex items-center gap-1.5 text-xs text-app-text-muted"
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block h-2 w-2 rounded-full ${SEVERITY_STYLES[severity].bar}`}
                      />
                      {summary.counts[severity]} {SEVERITY_STYLES[severity].label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {summary.total === 0 ? (
              <p className="text-center text-xs text-app-text-muted">
                Nothing needs documenting right now.
              </p>
            ) : (
              isWide && (
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-medium text-app-text-muted">Needs documenting</p>
                  <GapList gaps={gaps} />
                </div>
              )
            )}
          </div>
        </section>

        <section
          aria-label="Recurring questions"
          className="border-t border-app-border-muted pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6"
        >
          <ColumnHeading
            label="Recurring questions"
            total={askedCount === 1 ? "1 asked" : `${askedCount} asked`}
          />

          {groups.length === 0 ? (
            <p className="text-xs text-app-text-muted">No recurring questions yet.</p>
          ) : (
            <QuestionBars groups={groups} limit={VISIBLE_ROW_COUNT} />
          )}
        </section>
      </div>
    </ClickableCard>
  );
}
