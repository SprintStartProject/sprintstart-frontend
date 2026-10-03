import { CheckCircle2, CircleAlert, ListChecks } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryFetch } from "../../../../hooks/useQueryFetch";
import { insightsService } from "../../../../services/faqService";
import { knowledgeGapService } from "../../../../services/knowledgeGapService";
import { knowledgeRequestService } from "../../../../services/knowledgeRequestService";
import { queryKeys } from "../../../../services/queryKeys";
import type { OnboardingFeedback } from "../../../../services/teamManagementService";
import { fetchIngestionSources } from "../../../data-ingestion/ingestionSources";
import type { ProjectAttention, ProjectOnboardingMetrics } from "../../../onboarding-metrics/types";
import { useProjectContext } from "../../../projects/useProjectContext";
import type { TeamOverviewUser } from "../../../team-management/types";
import { AREA_META, SEVERITY_META } from "../../analysis/analysisMeta";
import { buildFindings, type Finding } from "../../analysis/findings";

/** The most findings the strip shows; fewer when the line is too narrow for them. */
const MAX_SHOWN = 4;
/** The gap between pills (`gap-2`), for the measurement. */
const PILL_GAP_PX = 8;

/**
 * One finding as a pill: the severity's icon and tint, and the title. The detail is its tooltip —
 * the strip stays one line high.
 */
function TodayPill({
  finding,
  measureOnly = false,
}: {
  finding: Finding;
  /** Drawn only to be measured: inert, no link, nothing announced. */
  measureOnly?: boolean;
}) {
  const severity = SEVERITY_META[finding.severity];
  const SeverityIcon = severity.icon;
  const area = AREA_META[finding.area];
  const body = (
    <>
      <SeverityIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{finding.title}</span>
    </>
  );
  const className = `inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${severity.badge}`;
  const label = `${severity.label}, ${area.label}: ${finding.title}`;

  if (measureOnly) return <span className={className}>{body}</span>;

  return finding.to ? (
    <Link
      to={finding.to}
      title={finding.detail}
      aria-label={label}
      className={`${className} transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
    >
      {body}
    </Link>
  ) : (
    <span title={finding.detail} aria-label={label} className={className}>
      {body}
    </span>
  );
}

/**
 * "What needs you today": the project analysis's findings, worked out on every visit without
 * anybody pressing a button, at the top of the overview.
 *
 * Same rules as the analysis (`buildFindings`), fed from the cache entries the overview's other
 * cards already read — so it costs no request of its own on the overview and can never disagree
 * with them. Only what asks something of the manager is listed (critical, needs a look, good to
 * know), most pressing first; what is going well stays in the full analysis, which also keeps the
 * score and its history.
 *
 * A part that could not be read makes no findings, so the card says so rather than reporting a
 * calm day it cannot vouch for.
 */
export function TodayCard({
  roster,
  feedbackByUser,
  metrics,
  attention,
  loading,
  onOpenAnalysis,
}: {
  /** The team as the overview shows it; `null` while loading or when it could not be read. */
  roster: TeamOverviewUser[] | null;
  /** Each flagged member's feedback, by user id — the entries the overview already loaded. */
  feedbackByUser: Record<string, OnboardingFeedback[]>;
  metrics: ProjectOnboardingMetrics | null;
  attention: ProjectAttention | null;
  /** The team or its attention list is still loading. */
  loading: boolean;
  /** Opens the full project analysis — where "+N more" leads. */
  onOpenAnalysis?: () => void;
}) {
  const { selectedProjectId } = useProjectContext();
  const enabled = Boolean(selectedProjectId);

  const escalations = useQueryFetch(
    queryKeys.knowledgeRequest.open(selectedProjectId),
    () => knowledgeRequestService.listOpen(selectedProjectId),
    { enabled },
  );
  const faq = useQueryFetch(
    queryKeys.faq.groups(selectedProjectId),
    () => insightsService.fetchFAQGroups(selectedProjectId),
    { enabled },
  );
  const gaps = useQueryFetch(
    queryKeys.knowledgeGaps.overview(selectedProjectId),
    () => knowledgeGapService.fetchKnowledgeGaps(selectedProjectId),
    { enabled },
  );
  const sources = useQueryFetch(
    queryKeys.ingestion.sourceStatuses(selectedProjectId),
    () => fetchIngestionSources(selectedProjectId),
    { enabled },
  );

  const reads = [escalations, faq, gaps, sources];
  const reading = loading || reads.some((read) => read.loading);
  const unreadable = roster === null && !loading;
  const failed = unreadable || reads.some((read) => read.error);

  const findings = buildFindings({
    roster,
    feedbackByUser,
    metrics,
    attention,
    escalations: escalations.data,
    faq: faq.data,
    gaps: gaps.data,
    sources:
      sources.data?.map((source) => ({
        name: source.name,
        errors: source.errors,
        lastRunAt: source.lastRunAt,
        backendStatus: source.backendStatus,
      })) ?? null,
    industry: null,
  }).filter((finding) => finding.severity !== "good");

  // As many of the most pressing findings as fit on the line whole, up to four: measured off an
  // invisible copy of the pills, so a wide screen shows four and a narrow one fewer — never a pill
  // cut in half. At least one is always shown (it truncates if it has to).
  const candidates = findings.slice(0, MAX_SHOWN);
  const candidateKey = candidates.map((finding) => finding.id).join("|");
  const slotRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLUListElement | null>(null);
  const [fitting, setFitting] = useState(MAX_SHOWN);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const fit = () => {
      const available = slot.clientWidth;
      // No layout to go by (a test environment, a hidden tab): show them all.
      if (available === 0) {
        setFitting(MAX_SHOWN);
        return;
      }
      let used = 0;
      let count = 0;
      for (const item of Array.from(measure.children) as HTMLElement[]) {
        const width = item.offsetWidth + (count > 0 ? PILL_GAP_PX : 0);
        if (used + width > available) break;
        used += width;
        count += 1;
      }
      setFitting(Math.max(1, count));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [candidateKey]);

  const shown = candidates.slice(0, fitting);
  const more = findings.length - shown.length;

  return (
    <section
      aria-label="What needs you today"
      // Always one line: fewer pills on a narrow screen rather than a strip wrapped into a block.
      className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-2.5"
    >
      <h2 className="flex shrink-0 items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-app-text">
        <ListChecks aria-hidden="true" className="h-4 w-4 text-app-brand-text" />
        {/* Icon only on a phone, where the words would leave no room for a pill. */}
        <span className="max-sm:sr-only">Needs you today</span>
      </h2>

      {reading && findings.length === 0 ? (
        <p className="truncate text-xs text-app-text-muted">Reading the project…</p>
      ) : findings.length === 0 && !failed ? (
        <p className="flex items-center gap-1.5 text-xs text-app-text-muted">
          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-app-success-text" />
          Nothing needs you today.
        </p>
      ) : (
        <>
          <div ref={slotRef} className="relative min-w-0 flex-1">
            {/* The measuring copy: every candidate at its natural width, invisible and inert. */}
            <ul
              ref={measureRef}
              aria-hidden="true"
              inert
              className="pointer-events-none invisible absolute top-0 left-0 flex gap-2"
            >
              {candidates.map((finding) => (
                <li key={finding.id} className="max-w-[24rem] shrink-0">
                  <TodayPill finding={finding} measureOnly />
                </li>
              ))}
            </ul>
            {shown.length > 0 && (
              <ul className="flex min-w-0 items-center gap-2">
                {shown.map((finding, index) => (
                  <li
                    key={finding.id}
                    // The last one shown may shrink and truncate; the others keep their width.
                    className={`max-w-[24rem] ${index === shown.length - 1 ? "min-w-0" : "shrink-0"}`}
                  >
                    <TodayPill finding={finding} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {more > 0 &&
            (onOpenAnalysis ? (
              <button
                type="button"
                onClick={onOpenAnalysis}
                className="shrink-0 rounded-md px-1 text-xs font-medium whitespace-nowrap text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                aria-label={`${more} more — open the project analysis`}
              >
                +{more} more
              </button>
            ) : (
              <span className="shrink-0 text-xs whitespace-nowrap text-app-text-muted">
                +{more} more
              </span>
            ))}
          {failed && (
            <span
              className="flex shrink-0 items-center gap-1 text-xs text-app-text-muted"
              title="Some parts could not be read, so this may be missing something."
            >
              <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 text-app-warning-text" />
              Incomplete
            </span>
          )}
        </>
      )}
    </section>
  );
}
