import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { getSkillRoleNames } from "../data";
import type { LoadingState, ProjectRole, Skill } from "../types";
import { AccessBadge } from "./Badges";
import { RoleBadgeList } from "./RoleBadgeList";
import { StatusChip } from "./StatusChip";
import { TableHeader } from "./TableHeader";

type SkillsTabProps = {
  skills: Skill[];
  roles: ProjectRole[];
  loadingState: LoadingState;
  errorMessage: string;
  hasSearchQuery: boolean;
  totalCount: number;
  onOpenSkillDetails: (skill: Skill) => void;
  onRetryLoad: () => void;
};

export function SkillsTab({
  skills,
  roles,
  loadingState,
  errorMessage,
  hasSearchQuery,
  totalCount,
  onOpenSkillDetails,
  onRetryLoad,
}: SkillsTabProps) {
  if (loadingState === "idle" || loadingState === "loading") {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-app-border bg-app-surface">
        <div className="flex flex-col items-center gap-3 text-app-text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
          <p className="text-sm">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (loadingState === "error") {
    return (
      <EmptyState
        icon={<AlertCircle className="h-8 w-8 text-app-danger-solid" />}
        title="Skills could not be loaded"
        action={
          <button
            type="button"
            onClick={onRetryLoad}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-app-text px-5 py-2.5 text-sm font-medium text-app-text-inverse transition-colors hover:opacity-90"
          >
            Try again
          </button>
        }
      >
        {errorMessage}
      </EmptyState>
    );
  }

  if (skills.length === 0) {
    const noSkillsExist = totalCount === 0;

    return (
      <EmptyState title={noSkillsExist ? "No skills yet" : "No skills found"}>
        {noSkillsExist
          ? "Create the first skill to start building the pool."
          : hasSearchQuery
            ? "Try adjusting your search term."
            : "Try another search term or change the filters."}
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
      <div className="hidden grid-cols-[2fr_1fr_1.8fr_1fr_1fr_36px] items-center border-b border-app-border bg-app-surface-muted px-5 py-3.5 sm:grid">
        <TableHeader>Name</TableHeader>
        <TableHeader>Category</TableHeader>
        <TableHeader>Roles</TableHeader>
        <TableHeader>Universal</TableHeader>
        <TableHeader>Status</TableHeader>
        <div />
      </div>

      {skills.map((skill) => {
        const roleNames = getSkillRoleNames(skill, roles);

        return (
          <div
            key={skill.id}
            // Mobile stacks the name above a wrapping row of the remaining
            // facts; `sm:contents` lets that row's children flow back into
            // the header's five columns once there is room for them side by
            // side (same trick `UsersTab` uses for its badge pair).
            className="group relative grid cursor-pointer grid-cols-1 items-center gap-y-2 border-b border-app-border px-3 py-3 transition-colors last:border-b-0 hover:bg-app-surface-hover hover:shadow-[inset_3px_0_0_0_var(--color-app-brand)] sm:grid-cols-[2fr_1fr_1.8fr_1fr_1fr_36px] sm:items-center sm:gap-y-0 sm:px-5 sm:py-4"
          >
            <button
              type="button"
              onClick={() => onOpenSkillDetails(skill)}
              className="absolute inset-0 z-0 focus-ring-inset"
              aria-label={`Open details for ${skill.name}`}
            />

            <div className="pointer-events-none relative z-10 min-w-0 text-left">
              <span className="truncate text-sm font-semibold text-app-text">{skill.name}</span>
            </div>

            <div className="pointer-events-none relative z-10 flex flex-wrap items-center gap-2 sm:contents">
              <span className="text-sm text-app-text-muted">{skill.category ?? "—"}</span>

              <div className="pointer-events-auto min-w-0">
                <RoleBadgeList roles={roleNames} />
              </div>

              <div className="min-w-0">
                {skill.universal && <AccessBadge variant="brand">Universal</AccessBadge>}
              </div>

              <div className="min-w-0">
                <StatusChip
                  active={skill.status === "ACTIVE"}
                  activeLabel="Active"
                  inactiveLabel="Retired"
                  inactiveVariant="warning"
                  inactiveKind="disabled"
                />
              </div>

              <div className="hidden items-center justify-end text-app-text-muted transition-colors group-hover:text-app-text sm:flex">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
