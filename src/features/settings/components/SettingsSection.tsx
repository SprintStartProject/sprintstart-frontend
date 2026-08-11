import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type SettingsSectionProps = {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
};

/**
 * A titled, anchorable block within the single-scroll settings page.
 * The `id` is used by the section nav for jump-to-anchor navigation.
 */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <div className="mb-4 flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-app-brand-text" aria-hidden />
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-app-text">
            {title}
          </h2>
          <p className="mt-1 text-sm text-app-text-subtle">{description}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-6">
        {children}
      </div>
    </section>
  );
}
