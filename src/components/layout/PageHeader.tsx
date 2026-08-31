import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  /**
   * Hides the subtitle below the given Tailwind breakpoint until that width is
   * reached. Useful on space-constrained mobile layouts (e.g. the chat header)
   * where the subtitle is secondary. `undefined` keeps the subtitle always visible.
   */
  hideSubtitleBelow?: "sm" | "md" | "lg";
  /** Optional click handler for the header icon (e.g., for easter eggs). */
  onIconClick?: () => void;
  /**
   * Marks the icon as hiding an easter egg: it grows slightly on hover and
   * plays a one-shot glow pulse on mount. Purely decorative, so it is not
   * reflected in the accessible name; users who prefer reduced motion get
   * neither effect (see the page-header-icon rules in styles/index.css).
   */
  eggHint?: boolean;
};

export function PageHeader({
  icon: Icon,
  title,
  subtitle = "",
  actions,
  className = "",
  hideSubtitleBelow,
  onIconClick,
  eggHint = false,
}: PageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            {onIconClick ? (
              <button
                onClick={onIconClick}
                data-egg-hint={eggHint ? "true" : undefined}
                className="page-header-icon-button rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand"
                aria-label={`${title} icon`}
              >
                <Icon className="page-header-icon h-6 w-6 shrink-0 text-app-brand-text transition-transform active:scale-95" />
              </button>
            ) : (
              <Icon className="h-6 w-6 shrink-0 text-app-brand-text" />
            )}

            <h1 className="min-w-0 text-xl leading-tight font-semibold text-app-text sm:text-2xl">
              {title}
            </h1>
          </div>

          {subtitle ? (
            <p
              className={`mt-2 max-w-2xl text-sm leading-6 text-app-text-subtle ${
                hideSubtitleBelow ? `hidden ${hideSubtitleBelow}:block` : ""
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
