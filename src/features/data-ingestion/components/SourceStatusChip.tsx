import type { SourceStatusPresentation } from "../types.ts";

const TONE_CLASSNAMES: Record<SourceStatusPresentation["tone"], string> = {
  success: "border border-app-success-border bg-app-success-bg text-app-success-text",
  brand: "border border-app-brand-border bg-app-brand-soft text-app-brand-text",
  warning: "border border-app-warning-border bg-app-warning-bg text-app-warning-text",
  danger: "border border-app-danger-border bg-app-danger-bg text-app-danger-text",
  neutral: "border border-app-border bg-app-neutral-bg text-app-neutral-text",
};

const SIZE_CLASSNAMES = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-xs",
} as const;

type SourceStatusChipProps = {
  status: SourceStatusPresentation;
  size?: keyof typeof SIZE_CLASSNAMES;
};

/**
 * Renders the single unified source status as one chip: icon + label, never
 * color alone (color-blind accessibility, AGENTS.md §7). The `syncing` state
 * spins its icon. This is the only status badge a source shows — it replaces the
 * previous split of a backend badge next to a separate ingestion badge.
 */
export function SourceStatusChip({ status, size = "md" }: SourceStatusChipProps) {
  const Icon = status.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${TONE_CLASSNAMES[status.tone]} ${SIZE_CLASSNAMES[size]}`}
    >
      <Icon
        size={size === "sm" ? 12 : 14}
        className={`shrink-0 ${status.spinning ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {status.label}
    </span>
  );
}
