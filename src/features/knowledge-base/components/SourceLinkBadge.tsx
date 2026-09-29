import { ExternalLink } from "lucide-react";
import type { SourceSystem } from "../types";

/**
 * Maps the artifact's source system to a user-friendly label for opening the resource.
 */
function getSourceSystemLabel(sourceSystem: SourceSystem): string {
  switch (sourceSystem) {
    case "GITHUB":
      return "Open in GitHub";
    case "JIRA":
      return "Open in Jira";
    case "CONFLUENCE":
      return "Open in Confluence";
    default:
      return "Open source";
  }
}

const BADGE_CLASSES =
  "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted transition-colors hover:border-app-brand/50 hover:bg-app-surface-hover hover:text-app-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus";

interface SourceLinkBadgeProps {
  /** The destination URL for the artifact. */
  sourceUrl: string;
  /** The origin system of the artifact. */
  sourceSystem: SourceSystem;
  /** Targeting hook for end-to-end and unit tests. */
  testId?: string;
}

/**
 * Renders an external source link chip shared in the viewer drawer header,
 * styled identically in shape, typography, and borders to RepositoryBadge.
 */
export function SourceLinkBadge({
  sourceUrl,
  sourceSystem,
  testId = "artifact-drawer-source-link",
}: SourceLinkBadgeProps) {
  const label = getSourceSystemLabel(sourceSystem);

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      title={sourceUrl}
      aria-label={`${label} (opens in a new tab)`}
      className={BADGE_CLASSES}
    >
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </a>
  );
}
