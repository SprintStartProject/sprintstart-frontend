import { GitBranch, Ticket, FileText } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Badge } from "../../../../../components/ui/Badge";
import type { DraftSource, DraftSourceType } from "../../../projectSourcesDraft";

type WizardReviewStepProps = {
  name: string;
  description: string;
  /** Resolved manager display name, or null when no manager was picked. */
  managerName: string | null;
  /** Display names of the picked members, excluding the manager. */
  memberNames: string[];
  sources: DraftSource[];
  onEditDetails: () => void;
  onEditMembers: () => void;
  onEditSources: () => void;
};

const typeIcons: Record<DraftSourceType, ComponentType<{ className?: string }>> = {
  GITHUB: GitBranch,
  JIRA: Ticket,
  UPLOAD: FileText,
};

const typeLabels: Record<DraftSourceType, string> = {
  GITHUB: "GitHub",
  JIRA: "Jira",
  UPLOAD: "Upload",
};

function sourceTitle(source: DraftSource): string {
  return source.type === "GITHUB" ? `${source.owner}/${source.name}` : source.displayName;
}

function ReviewBlock({
  title,
  count,
  onEdit,
  children,
}: {
  title: string;
  count?: number;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-app-border">
      <header className="flex items-center justify-between border-b border-app-border bg-app-surface-muted px-4 py-2.5">
        <h4 className="text-sm font-semibold text-app-text">
          {title}
          {count !== undefined && <span className="text-app-text-muted"> · {count}</span>}
        </h4>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-app-brand-text transition hover:bg-app-brand-soft"
        >
          Edit
        </button>
      </header>
      <div className="px-4 py-3 text-sm">{children}</div>
    </section>
  );
}

/**
 * Step 4 of the create-project wizard: a read-only summary of everything that
 * the single "Create project" will commit, with a jump-back link per section.
 * The member count folds in the manager, who is created as a member too.
 */
export function WizardReviewStep({
  name,
  description,
  managerName,
  memberNames,
  sources,
  onEditDetails,
  onEditMembers,
  onEditSources,
}: WizardReviewStepProps) {
  const memberCount = memberNames.length + (managerName ? 1 : 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-app-text">Review</p>
        <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
          Everything below is created in one step. Jump back to change anything.
        </p>
      </div>

      <ReviewBlock title="Details" onEdit={onEditDetails}>
        <dl className="space-y-1.5">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Name</dt>
            <dd className="text-app-text">
              {name.trim() || <span className="text-app-danger-text">— required —</span>}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Description</dt>
            <dd className="text-app-text">
              {description.trim() || <span className="text-app-text-muted">—</span>}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Manager</dt>
            <dd className="text-app-text">
              {managerName ?? <span className="text-app-text-muted">None</span>}
            </dd>
          </div>
        </dl>
      </ReviewBlock>

      <ReviewBlock title="Members" count={memberCount} onEdit={onEditMembers}>
        {memberCount === 0 ? (
          <span className="text-app-text-muted">No members</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {managerName && (
              <Badge variant="brand" size="sm">
                {managerName} · Manager
              </Badge>
            )}
            {memberNames.map((memberName) => (
              <Badge key={memberName} variant="neutral" size="sm">
                {memberName}
              </Badge>
            ))}
          </div>
        )}
      </ReviewBlock>

      <ReviewBlock title="Sources" count={sources.length} onEdit={onEditSources}>
        {sources.length === 0 ? (
          <span className="text-app-text-muted">
            No sources — you can add them later from Data Ingestion.
          </span>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((source) => {
              const Icon = typeIcons[source.type];

              return (
                <li key={source.id} className="flex items-center gap-2 text-app-text">
                  <Icon className="h-4 w-4 shrink-0 text-app-text-muted" />
                  <span className="truncate">{sourceTitle(source)}</span>
                  <Badge variant="neutral" size="sm">
                    {typeLabels[source.type]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </ReviewBlock>
    </div>
  );
}
