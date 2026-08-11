import { useId } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { centralSpringToken } from "../../styles/tokens";

export type SegmentedControlOption<T extends string> = {
  id: T;
  label: string;
  /** Optional leading icon (lucide-style component taking a `className`). */
  icon?: ComponentType<{ className?: string }>;
  /** Optional `data-testid` for E2E targeting. */
  testId?: string;
};

type SegmentedControlProps<T extends string> = {
  options: ReadonlyArray<SegmentedControlOption<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Accessible name for the group (rendered as a `tablist`). */
  ariaLabel: string;
};

/**
 * A compact two-plus-way toggle rendered as an ARIA `tablist`. Used to switch
 * between co-located but distinct panels (e.g. the GitHub / Jira access-token
 * providers) without a full tab component. The active segment is highlighted by
 * a shared-layout indicator; the `layoutId` is derived from `useId` so multiple
 * controls mounted at once never animate into one another.
 *
 * Accessibility: every segment carries a text label (never color-only), so the
 * active state stays distinguishable for color-vision deficiencies (AGENTS.md §7).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full gap-1 rounded-xl border border-app-border bg-app-surface-muted p-1 sm:w-auto"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={option.testId}
            onClick={() => onChange(option.id)}
            className={`relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-app-focus sm:flex-none ${
              isActive
                ? "text-app-brand"
                : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`segmented-${layoutId}`}
                className="absolute inset-0 rounded-lg border border-app-brand-border bg-app-brand-soft"
                initial={false}
                transition={centralSpringToken}
              />
            )}
            {Icon && <Icon className="relative z-10 h-4 w-4" aria-hidden />}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
