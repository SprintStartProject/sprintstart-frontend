import { ArrowRightLeft, GitBranch, Ticket, FileText, BookOpen } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { UserAvatar } from "../../../../../components/common/UserAvatar";
import { SourceTypeBadge } from "../../../../data-ingestion/components/SourceTypeBadge";
import type { DraftSource, DraftSourceType } from "../../../projectSourcesDraft";

/** The minimum a review row needs to render a person with their avatar. */
export type ReviewPerson = {
  id: string;
  name: string;
  profileIcon?: string | null;
  /**
   * Names of the projects this person would be removed from when the project is
   * created. Only set for a regular user who is in other projects already.
   */
  movedFrom?: string[];
};

type WizardReviewStepProps = {
  name: string;
  description: string;
  industry: string;
  /** The picked manager, or null when none was chosen. */
  manager: ReviewPerson | null;
  /** The picked members, excluding the manager (shown separately). */
  members: ReviewPerson[];
  sources: DraftSource[];
  onEditDetails: () => void;
  onEditMembers: () => void;
  onEditSources: () => void;
};

const typeIcons: Record<DraftSourceType, ComponentType<{ className?: string }>> = {
  GITHUB: GitBranch,
  JIRA: Ticket,
  UPLOAD: FileText,
  CONFLUENCE: BookOpen,
};

const typeLabels: Record<DraftSourceType, string> = {
  GITHUB: "GitHub",
  JIRA: "Jira",
  UPLOAD: "Upload",
  CONFLUENCE: "Confluence",
};

function sourceTitle(source: DraftSource): string {
  return source.type === "GITHUB" ? `${source.owner}/${source.name}` : source.displayName;
}

function PersonChip({ person, suffix }: { person: ReviewPerson; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface py-0.5 pr-3 pl-0.5 text-xs text-app-text">
      <UserAvatar profileIcon={person.profileIcon} fallbackName={person.name} size={20} />
      <span className="truncate">
        {person.name}
        {suffix && <span className="text-app-text-muted"> · {suffix}</span>}
      </span>
    </span>
  );
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
  industry,
  manager,
  members,
  sources,
  onEditDetails,
  onEditMembers,
  onEditSources,
}: WizardReviewStepProps) {
  const memberCount = members.length + (manager ? 1 : 0);
  const movedMembers = members.filter((member) => member.movedFrom?.length);

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
              {name.trim() || <span className="text-app-danger-text">Required</span>}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Description</dt>
            <dd className="text-app-text">
              {description.trim() || <span className="text-app-text-muted">None</span>}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Industry</dt>
            <dd className="text-app-text">
              {industry.trim() || <span className="text-app-text-muted">Not set</span>}
            </dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="w-24 shrink-0 text-app-text-muted">Manager</dt>
            <dd className="text-app-text">
              {manager ? (
                <PersonChip person={manager} />
              ) : (
                <span className="text-app-text-muted">None</span>
              )}
            </dd>
          </div>
        </dl>
      </ReviewBlock>

      <ReviewBlock title="Members" count={memberCount} onEdit={onEditMembers}>
        {memberCount === 0 ? (
          <span className="text-app-text-muted">No members</span>
        ) : (
          <div className="space-y-3">
            {movedMembers.length > 0 && (
              <div
                role="note"
                className="flex items-start gap-2 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-2.5 text-xs text-app-warning-text"
              >
                <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p className="leading-relaxed">
                  {movedMembers.length === 1
                    ? "1 person is in another project and is moved here."
                    : `${movedMembers.length} people are in other projects and are moved here.`}{" "}
                  They are removed from their current project, and their project roles and
                  onboarding progress are reset.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {manager && <PersonChip person={manager} suffix="Manager" />}
              {members.map((member) => (
                <PersonChip
                  key={member.id}
                  person={member}
                  suffix={
                    member.movedFrom?.length
                      ? `moved from ${member.movedFrom.join(", ")}`
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
      </ReviewBlock>

      <ReviewBlock title="Sources" count={sources.length} onEdit={onEditSources}>
        {sources.length === 0 ? (
          <span className="text-app-text-muted">
            No sources. You can add them later from Data Ingestion.
          </span>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((source) => {
              const Icon = typeIcons[source.type];

              return (
                <li key={source.id} className="flex items-center gap-2 text-app-text">
                  <Icon className="h-4 w-4 shrink-0 text-app-text-muted" />
                  <span className="truncate">{sourceTitle(source)}</span>
                  <SourceTypeBadge type={typeLabels[source.type]} size="sm" />
                </li>
              );
            })}
          </ul>
        )}
      </ReviewBlock>
    </div>
  );
}
