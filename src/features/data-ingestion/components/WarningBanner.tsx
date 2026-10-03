import type { ReactNode } from "react";

/**
 * A warning that sits above or inside a section: something failed to load or does
 * not apply, but the rest of the page is still usable. `compact` is the tighter
 * padding the banner has inside a modal.
 */
export function WarningBanner({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-app-warning-border bg-app-warning-bg text-sm text-app-warning-text ${
        compact ? "px-4 py-3" : "px-5 py-4"
      }`}
    >
      {children}
    </div>
  );
}
