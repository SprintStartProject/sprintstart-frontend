import { motion, useReducedMotion } from "framer-motion";
import type { SegmentedTabOption } from "../../../components/ui/SegmentedTabs";
import { slidingIndicatorSpringToken } from "../../../styles/tokens";

type PmSubTabsProps<TValue extends string> = {
  value: TValue;
  options: SegmentedTabOption<TValue>[];
  onChange: (value: TValue) => void;
  /** Unique id for the sliding underline, as with `SegmentedTabs`. */
  layoutId: string;
  ariaLabel: string;
};

/**
 * The second level of tabs inside a PM section — Members / Roles, Open / Durable answers.
 *
 * Text with an underline rather than a second pill bar. The workspace's section bar is already a
 * pill slider, and the same control again a few pixels lower read as a slider inside a slider:
 * two bars of equal weight, with no way to tell which one is the page and which the view inside
 * it. The underline says "a view of this section" and leaves the pill to mean "a section".
 *
 * Same semantics as `SegmentedTabs` (a group of `aria-pressed` buttons, not a tablist) so the
 * two stay interchangeable for assistive technology and for tests.
 */
export function PmSubTabs<TValue extends string>({
  value,
  options,
  onChange,
  layoutId,
  ariaLabel,
}: PmSubTabsProps<TValue>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-5">
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            data-testid={option.testId}
            onClick={() => onChange(option.value)}
            className={`relative inline-flex items-center gap-1.5 rounded-md pt-1 pb-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
              isActive ? "text-app-text" : "text-app-text-muted hover:text-app-text"
            }`}
          >
            {option.icon ? (
              <span
                className={`flex items-center ${isActive ? "text-app-brand-text" : "opacity-70"}`}
              >
                {option.icon}
              </span>
            ) : null}
            <span className="leading-none">{option.label}</span>
            {typeof option.count === "number" && (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums ${
                  isActive
                    ? "bg-app-brand-soft text-app-brand-text"
                    : "bg-app-surface-muted text-app-text-subtle"
                }`}
              >
                {option.count}
              </span>
            )}
            {isActive && (
              <motion.span
                aria-hidden="true"
                layoutId={layoutId}
                transition={prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-app-brand"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
