import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { useToast } from "../../../context/useToast";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { useProjectContext } from "../../projects/useProjectContext";
import { useAttention } from "../hooks/useAttention";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { formatDaysAgo } from "../format";
import { formatDuration } from "../format";
import type { AttentionItem } from "../types";

/** How many attention rows the compact widget previews before deferring to the page. */
const PREVIEW_LIMIT = 3;

/** Severity chip: colour follows meaning — waiting on someone (warning) vs. drifting (danger). */
function severityChip(item: AttentionItem) {
  if (item.severity === "BLOCKED") {
    return (
      <span className="shrink-0 rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
        Waiting
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-app-danger-bg px-2 py-0.5 text-xs font-medium text-app-danger-text">
      Drifting
    </span>
  );
}

/**
 * Compact PM-dashboard summary of onboarding health, leading with the stall count
 * (the thing a PM should act on) and previewing who needs a human, then linking to
 * the full readout. Same widget → `/insights/*` page split as the other Insights
 * cards (`FaqWidget`, `KnowledgeGapWidget`).
 *
 * The metrics are derived on request, so "refresh" is a client-side refetch rather
 * than a pipeline trigger.
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

  const { attention, reload: reloadAttention } = useAttention(selectedProjectId);

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

  const stalled = metrics.stalledCount;
  const preview = attention?.items.slice(0, PREVIEW_LIMIT) ?? [];

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

      {/* Stall summary — the headline a PM acts on. */}
      {stalled > 0 ? (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-app-warning-solid" aria-hidden="true" />
          <p className="text-sm text-app-text">
            <span className="font-semibold">{stalled}</span> hire{stalled === 1 ? "" : "s"} stalled
            — worth acting on today.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-app-success-solid" aria-hidden="true" />
          <p className="text-sm text-app-text-muted">Nobody is stalled right now.</p>
        </div>
      )}

      <p className="mt-3 text-xs text-app-text-muted">
        Median time to first accepted work:{" "}
        <span className="font-medium text-app-text">
          {formatDuration(metrics.medianHoursToFirstAcceptedContribution)}
        </span>
      </p>

      {/* Who needs a human, top few. */}
      {preview.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-app-border pt-4">
          {preview.map((item) => (
            <li key={item.hireId} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-app-text">{item.hireName}</span>
                  {severityChip(item)}
                </div>
                <p className="mt-0.5 truncate text-xs text-app-text-muted">
                  {item.reason} · {formatDaysAgo(item.days)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ClickableCard>
  );
}
