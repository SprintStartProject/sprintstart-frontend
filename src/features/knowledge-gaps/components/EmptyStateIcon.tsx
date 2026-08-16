import { AlertCircle, ShieldCheck } from "lucide-react";

import { Spinner } from "../../../components/ui/Spinner";
import type { KnowledgeGapsEmptyState } from "../emptyState";

/**
 * The icon for an empty knowledge-gaps panel.
 *
 * Shared by the page and the dashboard widget so the two never disagree about
 * what a given state looks like — a clean result reads as a success, not as the
 * same muted warning that means "nothing here".
 */
export function EmptyStateIcon({ state }: { state: KnowledgeGapsEmptyState }) {
  if (state === "scanning") {
    return <Spinner size="lg" label="Scanning for knowledge gaps" />;
  }
  if (state === "clean") {
    return <ShieldCheck aria-hidden="true" className="h-5 w-5 text-app-success-text" />;
  }
  return (
    <AlertCircle
      aria-hidden="true"
      className={`h-5 w-5 ${state === "error" ? "text-app-danger-text" : "text-app-text-muted"}`}
    />
  );
}
