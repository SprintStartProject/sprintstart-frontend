import type { FilterSelectOption } from "../../components/ui/FilterSelect";
import { skillSuggestionKey } from "./skillSuggestion";
import { isSkillLinkedToRole } from "../../services/teamManagementTypes";
import type { ProjectRole, Skill, SkillSuggestion, TeamOverviewUser } from "../../services/teamManagementTypes";

export type RoleSort = "name" | "members" | "skills";

export const ROLE_SORT_OPTIONS: FilterSelectOption<RoleSort>[] = [
  { value: "name", label: "Name" },
  { value: "members", label: "Most members" },
  { value: "skills", label: "Most skills" },
];

/** The roles worth a look: nobody holds them, or they carry no skills to assess. */
export type RoleGapFilter = "no-members" | "no-skills";

/** Who the open role's member list narrows to; none chosen shows everyone, as on every list. */
export type MemberFilter = "holds" | "without";

/** Names in a sentence: the first few, then a count. */
export function nameList(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

export function fullName(user: TeamOverviewUser): string {
  return `${user.firstname} ${user.lastname}`;
}

/** Active skills first, then retired, each group alphabetical. */
export function skillsOfRole(skills: Skill[], roleId: string): Skill[] {
  return skills
    .filter((skill) => isSkillLinkedToRole(skill, roleId))
    .sort((first, second) =>
      first.status === second.status
        ? first.name.localeCompare(second.name)
        : first.status === "ACTIVE"
          ? -1
          : 1,
    );
}

export function membersOfRole(users: TeamOverviewUser[], roleId: string): TeamOverviewUser[] {
  return users.filter((user) => user.roles.some((userRole) => userRole.id === roleId));
}

/**
 * The catalog after a role's complete skill list came back: skills in the answer replace their
 * entries, skills the role does not list any more lose the link, and unknown ones are appended.
 */
export function mergeRoleSkills(current: Skill[], roleId: string, roleSkills: Skill[]): Skill[] {
  const responseById = new Map(roleSkills.map((skill) => [skill.id, skill]));
  const merged = current.map((skill) => {
    const updated = responseById.get(skill.id);
    if (updated) return updated;

    return isSkillLinkedToRole(skill, roleId)
      ? { ...skill, roleIds: skill.roleIds.filter((id) => id !== roleId) }
      : skill;
  });
  const knownIds = new Set(current.map(({ id }) => id));

  return [...merged, ...roleSkills.filter((skill) => !knownIds.has(skill.id))];
}

/** The catalog once a role is gone: no skill points at it any more. */
export function withoutRole(skills: Skill[], roleId: string): Skill[] {
  return skills.map((skill) => ({
    ...skill,
    roleIds: skill.roleIds.filter((id) => id !== roleId),
  }));
}

export type RoleListQuery = {
  query: string;
  gap: RoleGapFilter | null;
  sort: RoleSort;
  /** The open role always stays, so narrowing never closes what is being worked on. */
  openRoleId: string | null;
};

/** True when the toolbar narrows or reorders the list, so it offers a reset. */
export function isListNarrowed({ query, gap, sort }: RoleListQuery): boolean {
  return query.trim() !== "" || gap !== null || sort !== "name";
}

/**
 * The roles the toolbar leaves: searched by name, description, skill or member, narrowed to a
 * gap, and sorted.
 */
export function filterAndSortRoles(
  roles: ProjectRole[],
  skills: Skill[],
  users: TeamOverviewUser[],
  { query, gap, sort, openRoleId }: RoleListQuery,
): ProjectRole[] {
  const needle = query.trim().toLowerCase();
  const matches = roles.filter((role) => {
    if (role.id === openRoleId) return true;
    const roleMembers = membersOfRole(users, role.id);
    const roleSkills = skillsOfRole(skills, role.id);
    if (gap === "no-members" && roleMembers.length > 0) return false;
    if (gap === "no-skills" && roleSkills.length > 0) return false;
    if (needle === "") return true;
    return [
      role.name,
      role.description ?? "",
      ...roleSkills.map((skill) => skill.name),
      ...roleMembers.map(fullName),
    ].some((text) => text.toLowerCase().includes(needle));
  });

  return [...matches].sort((first, second) => {
    if (sort === "members") {
      const diff = membersOfRole(users, second.id).length - membersOfRole(users, first.id).length;
      if (diff !== 0) return diff;
    }
    if (sort === "skills") {
      const diff = skillsOfRole(skills, second.id).length - skillsOfRole(skills, first.id).length;
      if (diff !== 0) return diff;
    }
    return first.name.localeCompare(second.name);
  });
}

/**
 * Everyone, with the current holders first.
 *
 * Ordered by the snapshot taken when the role was opened, not by the live ticks: sorting on the
 * live selection would make a card jump to the top the moment it is ticked, moving the rows under
 * the cursor mid-click. `sort` is stable, so within each group the original order survives.
 */
export function membersForAssignment(
  users: TeamOverviewUser[],
  originalUserIds: string[],
): TeamOverviewUser[] {
  const heldOriginally = new Set(originalUserIds);

  return [...users].sort(
    (first, second) =>
      (heldOriginally.has(first.userId) ? 0 : 1) - (heldOriginally.has(second.userId) ? 0 : 1),
  );
}

/** The open role's member list after its search and filter. */
export function filterMembers(
  ordered: TeamOverviewUser[],
  originalUserIds: string[],
  query: string,
  filter: MemberFilter | null,
): TeamOverviewUser[] {
  const heldOriginally = new Set(originalUserIds);
  const needle = query.trim().toLowerCase();
  return ordered.filter((user) => {
    if (filter === "holds" && !heldOriginally.has(user.userId)) return false;
    if (filter === "without" && user.roles.length > 0) return false;
    if (needle === "") return true;
    return fullName(user).toLowerCase().includes(needle);
  });
}

export type AssignmentChange = { userId: string; add: boolean };

/** The difference between what is ticked and what the role held when it was opened. */
export function assignmentChanges(
  selectedUserIds: string[],
  originalUserIds: string[],
): AssignmentChange[] {
  return [
    ...selectedUserIds
      .filter((id) => !originalUserIds.includes(id))
      .map((userId) => ({ userId, add: true })),
    ...originalUserIds
      .filter((id) => !selectedUserIds.includes(id))
      .map((userId) => ({ userId, add: false })),
  ];
}

/** What the backend holds once the given changes went through. */
export function applyChanges(original: string[], done: AssignmentChange[]): string[] {
  const held = new Set(original);
  done.forEach(({ userId, add }) => (add ? held.add(userId) : held.delete(userId)));
  return [...held];
}

/** The same suggestion can come twice; it is listed once, where it first appeared. */
export function uniqueSuggestions(suggestions: SkillSuggestion[]): SkillSuggestion[] {
  return Array.from(new Map(suggestions.map((item) => [skillSuggestionKey(item), item])).values());
}

/** The ticked suggestions the role does not carry yet, by id or by name. */
export function suggestionsToApply(
  suggestions: SkillSuggestion[],
  selectedKeys: Set<string>,
  roleSkills: Skill[],
): SkillSuggestion[] {
  const currentIds = new Set(roleSkills.map(({ id }) => id));
  const currentNames = new Set(roleSkills.map(({ name }) => name.trim().toLocaleLowerCase()));
  return suggestions.filter(
    (suggestion) =>
      selectedKeys.has(skillSuggestionKey(suggestion)) &&
      !(suggestion.skillId && currentIds.has(suggestion.skillId)) &&
      !currentNames.has(suggestion.name.trim().toLocaleLowerCase()),
  );
}

/** Reads a failed save back to the person: who could not be updated. */
export function failedMemberNames(failed: AssignmentChange[], users: TeamOverviewUser[]): string[] {
  return failed.map(({ userId }) => {
    const user = users.find((candidate) => candidate.userId === userId);
    return user ? fullName(user).trim() : "a member";
  });
}
