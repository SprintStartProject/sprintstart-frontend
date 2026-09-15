import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SettingsToggleRowProps = {
  /** Base for the title and description ids the switch is labelled and described by. */
  id: string;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Controls that belong to this toggle, shown under a divider inside the same card. */
  children?: ReactNode;
};

/**
 * A single on/off preference on the settings page: icon, title and description on the left,
 * a switch on the right, all inside one bordered card. Every switch in Settings goes through
 * this so they look and behave the same.
 *
 * The switch takes its accessible name from the visible title and its description from the
 * text underneath, so a screen reader announces the same words a sighted user reads.
 */
export function SettingsToggleRow({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: SettingsToggleRowProps) {
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <div className="rounded-xl border border-app-border bg-app-bg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-app-brand" aria-hidden />
          <div className="min-w-0">
            <div id={titleId} className="text-sm font-medium text-app-text">
              {title}
            </div>
            <div id={descriptionId} className="text-xs text-app-text-muted">
              {description}
            </div>
          </div>
        </div>
        {/* The knob is centred with items-center and a padded track, so it stays centred when
            sizes round to device pixels. A flat shadow keeps it from looking lifted. */}
        <button
          type="button"
          role="switch"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-checked={checked}
          onClick={() => onCheckedChange(!checked)}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
            checked ? "bg-app-brand" : "bg-app-border-strong",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out",
              checked ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>

      {children && <div className="mt-4 border-t border-app-border pt-4">{children}</div>}
    </div>
  );
}
