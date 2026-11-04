import { AlertTriangle, GitBranch, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "../../../../components/ui/EmptyState";

/** A one-line notice with a warning icon; `tone` picks the warning or the danger colours. */
export function DiscoveryAlert({
  tone,
  children,
}: {
  tone: "warning" | "danger";
  children: ReactNode;
}) {
  const colours =
    tone === "warning"
      ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
      : "border-app-danger-border bg-app-danger-bg text-app-danger-text";

  return (
    <div className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${colours}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function DiscoveringSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-app-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Discovering repositories…
    </div>
  );
}

export function NoRepositories({ hint }: { hint: ReactNode }) {
  return (
    <EmptyState icon={<GitBranch className="h-8 w-8" />} title="No repositories found">
      {hint}
    </EmptyState>
  );
}
