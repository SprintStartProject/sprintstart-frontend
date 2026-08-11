import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  className?: string;
  /**
   * Hides the subtitle below the given Tailwind breakpoint until that width is
   * reached. Useful on space-constrained mobile layouts (e.g. the chat header)
   * where the subtitle is secondary. `undefined` keeps the subtitle always visible.
   */
  hideSubtitleBelow?: "sm" | "md" | "lg";
  /**
   * Optional click handler for the header icon (e.g., for easter eggs).
   */
  onIconClick?: () => void;
};

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  className = "",
  hideSubtitleBelow,
  onIconClick,
}: PageHeaderProps) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            {onIconClick ? (
              <button
                onClick={onIconClick}
                className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand"
                aria-label={`${title} icon`}
              >
                <Icon className="h-6 w-6 shrink-0 text-app-brand-text transition-transform active:scale-95" />
              </button>
            ) : (
              <Icon className="h-6 w-6 shrink-0 text-app-brand-text" />
            )}

            <h1 className="min-w-0 text-xl leading-tight font-semibold text-app-text sm:text-2xl">
              {title}
            </h1>
          </div>

          <p
            className={`mt-2 max-w-2xl text-sm leading-6 text-app-text-subtle ${
              hideSubtitleBelow ? `hidden ${hideSubtitleBelow}:block` : ""
            }`}
          >
            {subtitle}
          </p>
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
