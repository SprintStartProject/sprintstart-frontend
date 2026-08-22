import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Gauge, Loader2 } from "lucide-react";
import { useFetch } from "../../../hooks/useFetch";
import { onboardingMetricsService } from "../../../services/onboardingMetricsService";
import { ClickableCard } from "../../../components/common/ClickableCard";
import { formatDuration } from "../format";

type OnboardingMetricsWidgetProps = {
  projectId: string;
};

/**
 * Compact dashboard summary of onboarding health, leading with the stall count —
 * the thing a PM should act on — and linking to the full readout. Same
 * widget → `/insights/*` page split as the other PM-dashboard widgets.
 */
export function OnboardingMetricsWidget({ projectId }: OnboardingMetricsWidgetProps) {
  const navigate = useNavigate();
  const { data: metrics, loading } = useFetch(
    () =>
      projectId ? onboardingMetricsService.fetchProjectMetrics(projectId) : Promise.resolve(null),
    [projectId],
  );

  const go = () => void navigate("/insights/onboarding");

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-app-border bg-app-surface p-6">
        <Loader2 className="h-5 w-5 animate-spin text-app-brand" aria-hidden="true" />
      </div>
    );
  }

  const stalled = metrics?.stalledCount ?? 0;

  return (
    <ClickableCard
      onClick={go}
      interactive={false}
      className="cursor-pointer rounded-2xl border border-app-border bg-app-surface p-5 transition-colors hover:border-app-brand-border-strong hover:bg-app-surface-hover has-[button:hover]:!border-app-border has-[button:hover]:!bg-app-surface"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-app-brand" aria-hidden="true" />
          <span className="text-sm font-semibold text-app-text">Onboarding metrics</span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            go();
          }}
          className="flex items-center gap-1 rounded-lg text-xs text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Full readout
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

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
          {formatDuration(metrics?.medianHoursToFirstAcceptedContribution ?? null)}
        </span>
      </p>
    </ClickableCard>
  );
}
