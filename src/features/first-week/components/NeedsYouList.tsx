import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { CheckSeverity, OverviewTarget, ReadinessCheck } from "../readiness";

const MAX_VISIBLE_NEEDS_YOU = 4;

const NEEDS_YOU_TONE_CLASSES: Record<CheckSeverity, string> = {
  critical: "bg-app-danger-bg text-app-danger-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  info: "bg-app-neutral-bg text-app-neutral-text",
};

export type NeedsYouListProps = {
  checks: ReadinessCheck[];
  onNavigate: (target: OverviewTarget) => void;
};

/**
 * Every open readiness check, worst first — see `buildReadiness` in `../readiness`. Replaces the
 * old ad hoc "Up next" list built from three hand-picked conditions.
 *
 * Capped to `MAX_VISIBLE_NEEDS_YOU` with a "Show all" toggle rather than truncated silently, and a
 * short success line in place of the list — never the whole section hidden — once nothing is
 * open, so a PM who checks this tab out of habit finds it in the same place every time.
 */
export function NeedsYouList({ checks, onNavigate }: NeedsYouListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? checks : checks.slice(0, MAX_VISIBLE_NEEDS_YOU);
  const hasMore = checks.length > MAX_VISIBLE_NEEDS_YOU;

  return (
    <section aria-label="Needs you">
      <h2 className="mb-3 text-lg font-semibold tracking-tight text-app-text">Needs you</h2>

      {checks.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-app-text-subtle">
          <CheckCircle2 className="h-4 w-4 text-app-success-solid" aria-hidden="true" />
          Nothing needs you right now.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((check) => (
              <NeedsYouRow key={check.id} check={check} onNavigate={onNavigate} />
            ))}
          </div>
          {hasMore && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setShowAll((current) => !current)}
            >
              {showAll ? "Show less" : "Show all"}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function NeedsYouRow({
  check,
  onNavigate,
}: {
  check: ReadinessCheck;
  onNavigate: (target: OverviewTarget) => void;
}) {
  const Icon = check.severity === "info" ? Info : AlertTriangle;

  return (
    <div
      data-testid={`overview-needs-${check.id}`}
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-4"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${NEEDS_YOU_TONE_CLASSES[check.severity]}`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-app-text">{check.title}</p>
        <p className="text-xs text-app-text-subtle">{check.description}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        onClick={() => onNavigate(check.target)}
      >
        {check.actionLabel}
      </Button>
    </div>
  );
}
