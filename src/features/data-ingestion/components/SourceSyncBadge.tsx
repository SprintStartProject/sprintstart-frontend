import type { SourceStatus } from "../types.ts";

const TONE_CLASSNAMES: Record<SourceStatus, string> = {
  connected: "border-app-success-border bg-app-success-bg text-app-success-text",
  running: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
  // Danger, not warning: the warning palette renders amber-yellow text on a
  // red-looking background in dark mode.
  warning: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
  disabled: "border-app-border bg-app-neutral-bg text-app-neutral-text",
};

const SIZE_CLASSNAMES = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-xs",
} as const;

type SourceSyncBadgeProps = {
  /** Sync outcome, e.g. "Synced", "Running", "Failed", "Partial", "Not synced". */
  label: string;
  status: SourceStatus;
  size?: keyof typeof SIZE_CLASSNAMES;
};

/**
 * Secondary badge showing a source's ingestion/sync outcome next to the unified
 * status chip. The chip conveys connection state (Connected/Disabled/Syncing);
 * this adds the sync freshness the chip collapses away. Shared by the source
 * list, the details drawer and the admin project view so all three agree.
 */
export function SourceSyncBadge({ label, status, size = "md" }: SourceSyncBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${TONE_CLASSNAMES[status]} ${SIZE_CLASSNAMES[size]}`}
    >
      {label}
    </span>
  );
}
