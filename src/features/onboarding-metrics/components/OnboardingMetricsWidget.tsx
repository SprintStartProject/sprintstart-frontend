import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Gauge,
  Hourglass,
  Loader2,
  RefreshCw,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { useToast } from "../../../context/useToast";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { useProjectContext } from "../../projects/useProjectContext";
import { useAttention } from "../hooks/useAttention";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Badge, type BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { StatTile } from "./StatTile";
import { formatDaysAgo, formatDuration } from "../format";
import type { AttentionItem, AttentionSeverity } from "../types";

/** How many attention rows the compact widget previews before deferring to the page. */
const PREVIEW_LIMIT = 2;

/**
 * How each severity reads: whose move it is, in a word, an icon and a colour.
 * `BLOCKED` is waiting on somebody else (a review) — a warning, not the hire's
 * fault. `DRIFTING` is the hire losing momentum on their own — the more pointed
 * danger. The accent bar carries the same colour so a glance down the list sorts
 * them without reading.
 */
const SEVERITY_META: Record<
  AttentionSeverity,
  { label: string; Icon: LucideIcon; variant: BadgeVariant; bar: string }
> = {
  BLOCKED: { label: "Waiting", Icon: Clock, variant: "orange", bar: "bg-app-orange-text" },
  DRIFTING: { label: "Drifting", Icon: TrendingDown, variant: "danger", bar: "bg-app-danger-solid" },
};

/** One "needs attention" row: avatar, name + severity badge, reason, and how long it's been true. */
function AttentionRow({ item }: { item: AttentionItem }) {
  const meta = SEVERITY_META[item.severity];
  return (
    <li className="flex items-center gap-3">
      <span className={`w-1 shrink-0 self-stretch rounded-full ${meta.bar}`} aria-hidden="true" />
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-app-surface-muted">
        <UserAvatar size={32} fallbackName={item.hireName} seed={item.hireId} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-app-text">{item.hireName}</span>
          <Badge variant={meta.variant} size="md" className="shrink-0 gap-1">
            <meta.Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.label}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-app-text-muted">{item.reason}</p>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-app-brand-border bg-app-brand-soft px-2.5 py-1 text-xs font-semibold text-app-brand-text"
        title={formatDaysAgo(item.days)}
      >
        <Hourglass className="h-3 w-3" aria-hidden="true" />
        {item.days <= 0 ? "today" : `${item.days}d`}
      </span>
    </li>
  );
}

/**
 * Compact PM-dashboard summary of onboarding health, a peer card to the other
 * Insights widgets (`FaqWidget`, `KnowledgeGapWidget`). It deliberately carries
 * only the two questions a PM answers at a glance — how many hires are stuck, and
 * how fast onboarding reaches a first accepted piece of work — plus a short "who
 * needs a human" preview; everything else lives on the full readout it links to.
 *
 * The metrics are derived on request, so "refresh" is a client-side refetch
 * rather than a pipeline trigger.
 */
export function OnboardingMetricsWidget() {
  const { selectedProjectId } = useProjectContext();
  const navigate = useNavigate();
  const toast = useToast();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: metrics,
    loading,
    error,
  } = useFetch(
    () =>
      selectedProjectId
        ? onboardingMetricsService.fetchProjectMetrics(selectedProjectId)
        : Promise.resolve(null),
    [selectedProjectId, refreshKey],
  );

  const { attention, isLoading: attentionLoading, reload: reloadAttention } =
    useAttention(selectedProjectId);

  const openPage = () => void navigate("/insights/onboarding");

  const handleRefresh = async () => {
    if (!selectedProjectId) return;
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
    try {
      await reloadAttention();
    } catch {
      toast.error("Couldn't refresh onboarding metrics", { description: "Try again shortly." });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Spinner size="lg" label="Loading" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-app-border bg-app-surface p-6 text-center">
        <AlertCircle className="h-5 w-5 text-app-text-muted" />
        <p className="text-sm text-app-text-muted">
          Onboarding metrics couldn&apos;t be loaded for this project.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleRefresh()}
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={openPage}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Open page
          </Button>
        </div>
      </div>
    );
  }

  const totalAttention = attention?.items.length ?? 0;
  const preview = attention?.items.slice(0, PREVIEW_LIMIT) ?? [];
  const extra = totalAttention - preview.length;

  return (
    <ClickableCard
      onClick={openPage}
      interactive={false}
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-app-brand" />
          <span className="text-sm font-semibold text-app-text">Onboarding metrics</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={(event) => {
              event.stopPropagation();
              void handleRefresh();
            }}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              openPage();
            }}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            See all
          </Button>
        </div>
      </div>

      {/* The two numbers that matter at a glance. */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Stalled hires"
          value={metrics.stalledCount}
          hint={metrics.stalledCount > 0 ? "Worth acting on today" : "Nobody stalled"}
        />
        <StatTile
          label="Time to first accepted work"
          value={formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
          hint="Median, joined → accepted"
        />
      </div>

      {/* Needs attention — the call to action, top few. */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
            Needs attention
          </span>
          {totalAttention > 0 && (
            <Badge variant="neutral" size="sm">
              {totalAttention}
            </Badge>
          )}
        </div>

        {attentionLoading && !attention ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-app-brand" aria-hidden="true" />
          </div>
        ) : preview.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-app-success-bg/40 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-app-success-solid" aria-hidden="true" />
            <p className="text-sm text-app-text">Everyone&apos;s on track — nobody is waiting.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {preview.map((item) => (
              <AttentionRow key={item.hireId} item={item} />
            ))}
            {extra > 0 && (
              <li>
                <span className="text-xs font-medium text-app-brand-text">
                  +{extra} more on the full readout
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </ClickableCard>
  );
}
