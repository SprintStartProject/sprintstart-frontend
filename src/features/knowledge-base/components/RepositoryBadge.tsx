import { FolderGit2 } from "lucide-react";

/**
 * The `owner/repository` chip shared by the artifact list card and the viewer
 * drawer, so the two render sites cannot drift apart in styling or behavior.
 *
 * Repo names are case-sensitive identifiers, so unlike neighboring chips the
 * label is not uppercased. A long name ellipsizes (the badge is shrinkable)
 * while the full identifier stays reachable through the `title` tooltip.
 * `FolderGit2` reads as "repository" — `GitBranch` reads as "branch".
 */
const BADGE_CLASSES =
  "flex min-w-0 items-center gap-1.5 rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted";

interface RepositoryBadgeProps {
  /** The `owner/repository` string to display; also the tooltip text. */
  repository: string;
  /** Targeting hook for end-to-end tests (list and drawer use different ones). */
  testId: string;
}

/** Renders the repository chip described above. */
export function RepositoryBadge({ repository, testId }: RepositoryBadgeProps) {
  return (
    <span data-testid={testId} title={repository} className={BADGE_CLASSES}>
      <FolderGit2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{repository}</span>
    </span>
  );
}
