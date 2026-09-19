import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { CheckSeverity, OverviewTarget, ReadinessCheck } from "../readiness";
import { StatusDot, type StatusTone } from "./StageCard";

const MAX_VISIBLE_NEEDS_YOU = 3;

const NEEDS_YOU_TONE_CLASSES: Record<CheckSeverity, string> = {
  critical: "bg-app-danger-bg text-app-danger-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  info: "bg-app-neutral-bg text-app-neutral-text",
};

const SEVERITY_DOT_TONE: Record<CheckSeverity, StatusTone> = {
  critical: "danger",
  warning: "warning",
  info: "info",
};

export type NeedsYouListProps = {
  checks: ReadinessCheck[];
  onNavigate: (target: OverviewTarget) => void;
};

/**
 * Every open readiness check, worst first — see `buildReadiness` in `../readiness`. Sits above the
 * stage board rather than buried under it, as the thing most worth a PM's first look.
 *
 * A grid of cards from `sm` up, capped to `MAX_VISIBLE_NEEDS_YOU` with a "Show all" toggle rather
 * than truncated silently; a compact tappable list below it, each row a full-width button straight
 * to that check's target. Below `sm`, only the list renders (the grid is `hidden`) and vice versa —
 * two markups of the same data rather than one reflowing awkwardly at both sizes. A short success
 * line replaces the list — never the whole section hidden — once nothing is open, so a PM who
 * checks this tab out of habit finds it in the same place every time.
 */
export function NeedsYouList({ checks, onNavigate }: NeedsYouListProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? checks : checks.slice(0, MAX_VISIBLE_NEEDS_YOU);
  const hasMore = checks.length > MAX_VISIBLE_NEEDS_YOU;

  return (
    <section aria-label="Needs you">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-app-text">Needs you</h2>
        {checks.length > 0 && (
          <span className="text-sm text-app-text-subtle">
            {visible.length} of {checks.length}, worst first
          </span>
        )}
        {hasMore && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Show less" : `Show all ${checks.length}`}
          </Button>
        )}
      </div>

      {checks.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-app-text-subtle">
          <CheckCircle2 className="h-4 w-4 text-app-success-solid" aria-hidden="true" />
          Nothing needs you right now.
        </p>
      ) : (
        <>
          <div className="hidden gap-4 sm:grid sm:grid-cols-3">
            {visible.map((check) => (
              <NeedsYouCard key={check.id} check={check} onNavigate={onNavigate} />
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface sm:hidden">
            {visible.map((check, index) => (
              <NeedsYouRow
                key={check.id}
                check={check}
                onNavigate={onNavigate}
                isLast={index === visible.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function NeedsYouCard({
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
      className={`flex flex-col gap-3 rounded-2xl border bg-app-surface p-[18px] ${
        check.severity === "critical" ? "border-app-danger-border" : "border-app-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${NEEDS_YOU_TONE_CLASSES[check.severity]}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-app-text">{check.title}</p>
          <p className="mt-0.5 text-xs text-app-text-subtle">{check.description}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-auto self-start"
        onClick={() => onNavigate(check.target)}
      >
        {check.actionLabel}
      </Button>
    </div>
  );
}

/** A compact, fully tappable row for the mobile list — see `NeedsYouList`. */
function NeedsYouRow({
  check,
  onNavigate,
  isLast,
}: {
  check: ReadinessCheck;
  onNavigate: (target: OverviewTarget) => void;
  isLast: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={`overview-needs-mobile-${check.id}`}
      onClick={() => onNavigate(check.target)}
      className={`flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left ${
        isLast ? "" : "border-b border-app-border"
      }`}
    >
      <StatusDot tone={SEVERITY_DOT_TONE[check.severity]} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-app-text">
        {check.title}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-app-text-subtle" aria-hidden="true" />
    </button>
  );
}
