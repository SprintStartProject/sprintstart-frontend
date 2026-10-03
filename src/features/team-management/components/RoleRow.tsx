import { ChevronDown, Layers, Trash2 } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Button } from "../../../components/ui/Button";
import type { ProjectRole, Skill, TeamOverviewUser } from "../types";

/** Avatars beside a row before it says "+N": a row has room for a few faces, not a wall. */
const MAX_SHOWN_MEMBERS = 4;

type RoleRowProps = {
  role: ProjectRole;
  /** Skills of this role, already filtered and sorted by the parent. */
  skills: Skill[];
  /** The members holding this role, already filtered by the parent. */
  members: TeamOverviewUser[];
  /** This role is open: its panel is expanded right under the row. */
  selected: boolean;
  onSelect: (roleId: string) => void;
  onRequestDelete: (roleId: string) => void;
};

/**
 * One role as a row of the roles list — the same shape as the rows of the team, the recurring
 * questions and the knowledge gaps, so the PM area reads as one list style throughout.
 *
 * Name, how many hold it and its description on the left; who holds it and how many skills it
 * carries on the right. Pressing the row opens the role's panel right under it (see
 * `RoleManagementTab`); pressing it again closes it.
 *
 * The whole row is the toggle, which rules out wrapping it in a button — the delete control is a
 * button itself and cannot nest. Instead an invisible button covers the row and the content layer
 * is click-through, with the delete control opting back in.
 */
export function RoleRow({
  role,
  skills,
  members,
  selected,
  onSelect,
  onRequestDelete,
}: RoleRowProps) {
  const shownMembers = members.slice(0, MAX_SHOWN_MEMBERS);
  const hiddenMemberCount = members.length - shownMembers.length;
  const retiredCount = skills.filter((skill) => skill.status === "RETIRED").length;

  return (
    <div
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
        selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
      }`}
    >
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => onSelect(role.id)}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <span className="sr-only">
          {selected ? `Close ${role.name}` : `Manage skills and members of ${role.name}`}
        </span>
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text"
      >
        <Layers className="h-4 w-4" />
      </span>

      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-app-text">{role.name}</span>
          <span className="shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-medium text-app-text-muted tabular-nums">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-app-text-muted">
          {role.description || "No description"}
        </span>
      </span>

      {/* Who holds it, at a glance — the count alone left the list needing a click per role to
          answer "and who is that?". */}
      {members.length > 0 && (
        <span className="pointer-events-none relative hidden shrink-0 items-center md:flex">
          <span className="flex -space-x-1.5">
            {shownMembers.map((member) => {
              const fullName = `${member.firstname} ${member.lastname}`;
              return (
                <span
                  key={member.userId}
                  title={fullName}
                  className="rounded-full ring-2 ring-app-surface"
                >
                  <UserAvatar
                    profileIcon={member.profileIcon}
                    fallbackName={fullName}
                    seed={member.userId}
                    size={22}
                  />
                </span>
              );
            })}
          </span>
          {hiddenMemberCount > 0 && (
            <span className="ml-1.5 text-[11px] font-medium text-app-text-muted">
              +{hiddenMemberCount}
            </span>
          )}
        </span>
      )}

      <span className="pointer-events-none relative hidden w-24 shrink-0 text-right text-xs text-app-text-muted sm:block">
        {skills.length} {skills.length === 1 ? "skill" : "skills"}
        {retiredCount > 0 && (
          <span className="block text-[11px] text-app-warning-text">{retiredCount} retired</span>
        )}
      </span>

      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={`Delete ${role.name}`}
        onClick={() => onRequestDelete(role.id)}
        className="relative shrink-0 hover:text-app-danger-text"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none relative h-4 w-4 shrink-0 text-app-text-subtle transition-transform ${
          selected ? "rotate-180" : ""
        }`}
      />
    </div>
  );
}
