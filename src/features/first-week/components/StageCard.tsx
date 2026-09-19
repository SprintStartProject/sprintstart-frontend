import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import type { ReadinessCheck, StageReadiness } from "../readiness";

export type StatusTone = "success" | "warning" | "danger" | "info";

/** Maps a stage's `ready | attention | missing` onto the app's ordinary status colours. */
const STAGE_STATUS_TONE: Record<StageReadiness["status"], StatusTone> = {
  ready: "success",
  attention: "warning",
  missing: "danger",
};

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-app-success-solid",
  warning: "bg-app-warning-solid",
  danger: "bg-app-danger-solid",
  info: "bg-app-neutral-text",
};

/** A small coloured dot for a status ladder — never the only signal, always paired with text. */
export function StatusDot({ tone, className = "" }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[tone]} ${className}`}
    />
  );
}

/** One short sentence summarising a stage's open checks, read next to its status dot. */
function stageStatusSentence(status: StageReadiness["status"], checks: ReadinessCheck[]): string {
  if (status === "missing") {
    const count = checks.filter((check) => check.severity === "critical").length;
    return count === 1 ? "1 critical thing to fix" : `${count} critical things to fix`;
  }
  if (status === "attention") {
    const count = checks.filter((check) => check.severity !== "info").length;
    return count === 1 ? "1 thing needs attention" : `${count} things need attention`;
  }
  if (checks.length === 0) return "All set";
  return checks.length === 1 ? "1 thing worth a look" : `${checks.length} things worth a look`;
}

const MAX_VISIBLE_CHECKS = 3;

/** Up to three open checks, worst first (the order `buildReadiness` already sorted them in). */
function CheckListPreview({ checks }: { checks: ReadinessCheck[] }) {
  if (checks.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-app-text-subtle">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-app-success-solid" aria-hidden="true" />
        Nothing outstanding
      </p>
    );
  }

  const visible = checks.slice(0, MAX_VISIBLE_CHECKS);
  const remaining = checks.length - visible.length;

  return (
    <ul className="space-y-1">
      {visible.map((check) => (
        <li key={check.id} className="flex items-start gap-1.5 text-xs text-app-text-subtle">
          {check.severity === "info" ? (
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                check.severity === "critical" ? "text-app-danger-solid" : "text-app-warning-solid"
              }`}
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 flex-1">{check.title}</span>
        </li>
      ))}
      {remaining > 0 && <li>+{remaining} more</li>}
    </ul>
  );
}

export type StageCardProps = {
  testId: string;
  icon: LucideIcon;
  step: number;
  label: string;
  status: StageReadiness["status"];
  checks: ReadinessCheck[];
  /** A small side figure, e.g. "7 steps", "2 Task 0", "18 in the pool". */
  figureLabel: string;
  actionLabel: string;
  onClick: () => void;
};

/**
 * One stage of a hire's first week (Arrive, First task, Starter work), read from that stage's
 * readiness — see `buildReadiness` in `../readiness` — rather than a raw count. A click jumps
 * straight into that stage's tab.
 */
export function StageCard({
  testId,
  icon: Icon,
  step,
  label,
  status,
  checks,
  figureLabel,
  actionLabel,
  onClick,
}: StageCardProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-status={status}
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-surface p-5 text-left transition-colors hover:border-app-border-strong"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-app-brand-border bg-app-brand-soft text-xs font-bold text-app-brand-text">
          {step}
        </span>
        <span className="text-sm font-medium text-app-text-muted">{label}</span>
        <Icon className="ml-auto h-5 w-5 text-app-brand-text" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-2">
        <StatusDot tone={STAGE_STATUS_TONE[status]} />
        <p className="text-sm font-semibold text-app-text">{stageStatusSentence(status, checks)}</p>
      </div>

      <CheckListPreview checks={checks} />

      <p className="text-xs text-app-text-subtle">{figureLabel}</p>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-app-brand-text">
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
