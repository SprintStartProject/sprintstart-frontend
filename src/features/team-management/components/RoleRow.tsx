import { ChevronDown, Layers, Trash2, TriangleAlert } from "lucide-react";
import { UserAvatar } from "../../../components/common/UserAvatar";
import { Button } from "../../../components/ui/Button";
import type { ProjectRole, Skill, TeamOverviewUser } from "../types";

/** Avatars beside a row before it says "+N": a row has room for a few faces, not a wall. */
const MAX_SHOWN_MEMBERS = 4;
/** Members named in words beside the avatars; the rest are a count. */
const MAX_NAMED_MEMBERS = 2;
/** Skill chips on a row before "+N more": enough to tell roles apart, not the whole list. */
const MAX_SHOWN_SKILLS = 6;

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
 * Name, how many hold it, its description and its skills on the left; who holds it, by face and
 * by name, on the right. Pressing the row opens the role's panel right under it (see
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
  const shownSkills = skills.slice(0, MAX_SHOWN_SKILLS);
  const hiddenSkillCount = skills.length - shownSkills.length;
  const named = members.slice(0, MAX_NAMED_MEMBERS).map((member) => member.firstname);
  const memberNames =
    members.length === 0
      ? "Nobody yet"
      : `${named.join(", ")}${members.length > named.length ? ` +${members.length - named.length}` : ""}`;

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
        selected ? "bg-app-brand-soft" : "hover:bg-app-surface-hover"
      }`}
    >
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => onSelect(role.id)}
        className="absolute inset-0 rounded-xl"
      >
        <span className="sr-only">
          {selected ? `Close ${role.name}` : `Manage skills and members of ${role.name}`}
        </span>
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text"
      >
        <Layers className="h-4 w-4" />
      </span>

      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-app-text">{role.name}</span>
          {/* A role nobody holds is a gap worth seeing from the list: warning colour, an icon
              and the words, never the colour alone. */}
          {members.length === 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
              No members yet
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-text-muted tabular-nums">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          )}
          {retiredCount > 0 && (
            <span className="shrink-0 rounded-full bg-app-warning-bg px-2 py-0.5 text-xs font-medium text-app-warning-text">
              {retiredCount} retired
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-app-text-muted">
          {role.description || "No description"}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1">
          {shownSkills.map((skill) => (
            <span
              key={skill.id}
              className={`rounded-full border px-2 py-0.5 text-xs ${
                skill.status === "RETIRED"
                  ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
                  : "border-app-border bg-app-bg text-app-text"
              }`}
            >
              {skill.name}
            </span>
          ))}
          {hiddenSkillCount > 0 && (
            <span className="text-xs font-medium text-app-text-muted">
              +{hiddenSkillCount} more
            </span>
          )}
          {skills.length === 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-app-warning-text">
              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
              No skills yet — hires in this role have nothing to assess
            </span>
          )}
        </span>
      </span>

      {/* Who holds it, by face and by name — the count alone left the list needing a click per
          role to answer "and who is that?". */}
      <span className="pointer-events-none relative mt-0.5 hidden w-44 shrink-0 flex-col items-end gap-1 md:flex">
        {members.length > 0 && (
          <span className="flex items-center">
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
              <span className="ml-1.5 text-xs font-medium text-app-text-muted">
                +{hiddenMemberCount}
              </span>
            )}
          </span>
        )}
        <span className="max-w-full truncate text-xs text-app-text-muted">{memberNames}</span>
      </span>

      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={`Delete ${role.name}`}
        onClick={() => onRequestDelete(role.id)}
        className="relative mt-0.5 shrink-0 hover:text-app-danger-text"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none relative mt-2 h-4 w-4 shrink-0 text-app-text-subtle transition-transform ${
          selected ? "rotate-180" : ""
        }`}
      />
    </div>
  );
}
