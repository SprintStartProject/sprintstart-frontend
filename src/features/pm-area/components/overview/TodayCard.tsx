import { ArrowUpRight, CheckCircle2, CircleAlert, ListChecks } from "lucide-react";
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
import { PmCard, PmCardHeader } from "../PmCard";

/** How many findings the card lists; the rest are a count and a pointer to the full analysis. */
const ROWS = 5;

function TodayRow({ finding }: { finding: Finding }) {
  const severity = SEVERITY_META[finding.severity];
  const SeverityIcon = severity.icon;
  const area = AREA_META[finding.area];
  const AreaIcon = area.icon;
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${area.chip}`}
      >
        <AreaIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-app-text">{finding.title}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}
          >
            <SeverityIcon aria-hidden="true" className="h-3 w-3" />
            {severity.label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-app-text-muted">
          {area.label} · {finding.detail}
        </span>
      </span>
      {finding.to && (
        <ArrowUpRight
          aria-hidden="true"
          className="mt-1 h-4 w-4 shrink-0 text-app-text-subtle transition group-hover:text-app-text"
        />
      )}
    </>
  );
  const className = "group flex items-start gap-3 rounded-xl px-2 py-2";

  return finding.to ? (
    <Link
      to={finding.to}
      className={`${className} transition-colors hover:bg-app-surface-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
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
}: {
  /** The team as the overview shows it; `null` while loading or when it could not be read. */
  roster: TeamOverviewUser[] | null;
  /** Each flagged member's feedback, by user id — the entries the overview already loaded. */
  feedbackByUser: Record<string, OnboardingFeedback[]>;
  metrics: ProjectOnboardingMetrics | null;
  attention: ProjectAttention | null;
  /** The team or its attention list is still loading. */
  loading: boolean;
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

  const shown = findings.slice(0, ROWS);
  const more = findings.length - shown.length;
  const urgent = findings.some((finding) => finding.severity === "critical");

  return (
    <PmCard aria-label="What needs you today" tone={urgent ? "warning" : "brand"}>
      <PmCardHeader
        icon={ListChecks}
        tone={urgent ? "warning" : "brand"}
        title="What needs you today"
        meta={reading ? undefined : findings.length === 1 ? "1 open" : `${findings.length} open`}
      />

      {reading && findings.length === 0 ? (
        <p className="text-sm text-app-text-muted">Reading the project…</p>
      ) : findings.length === 0 && !failed ? (
        <p className="flex items-center gap-2 text-sm text-app-text-muted">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-app-success-text" />
          Nothing needs you today.
        </p>
      ) : (
        <>
          {shown.length > 0 && (
            <ul className="-mx-2 space-y-0.5">
              {shown.map((finding) => (
                <li key={finding.id}>
                  <TodayRow finding={finding} />
                </li>
              ))}
            </ul>
          )}
          {more > 0 && (
            <p className="mt-2 text-xs text-app-text-muted">
              {more === 1 ? "1 more" : `${more} more`} in the project analysis.
            </p>
          )}
          {failed && (
            <p className="mt-2 flex items-center gap-2 text-xs text-app-text-muted">
              <CircleAlert aria-hidden="true" className="h-3.5 w-3.5 text-app-warning-text" />
              Some parts could not be read, so this list may be missing something.
            </p>
          )}
        </>
      )}
    </PmCard>
  );
}
