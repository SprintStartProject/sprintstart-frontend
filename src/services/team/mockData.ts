import teamOverviewMock from "../../mocks/teamOverviewMock.json";
import skillsMock from "../../mocks/skillsMock.json";
import type { ProjectRole, Skill, SkillStatus } from "./featureTypes";
import { toTeamOverviewProjects, type BackendTeamOverviewUser } from "./overviewShape";

// The fixture predates the `projects` list and still carries a single
// `project`, so it goes through the same normalization as an API response.
export const mockUsers = (teamOverviewMock.users as unknown as BackendTeamOverviewUser[]).map(
  (user) => ({
    ...user,
    projects: toTeamOverviewProjects(user),
  }),
);

export const mockProjectRoles: ProjectRole[] = Array.from(
  new Map(mockUsers.flatMap((user) => user.roles).map((role) => [role.id, role])).values(),
);

type LegacySkill = {
  id: string;
  name: string;
  roleId?: string;
  roleIds?: string[];
  status?: SkillStatus;
  category?: string | null;
  universal?: boolean;
};

function normalizeSkill(skill: LegacySkill): Skill {
  const roleIds = skill.roleIds ?? (skill.roleId ? [skill.roleId] : []);

  return {
    id: skill.id,
    name: skill.name,
    roleIds,
    status: skill.status ?? "ACTIVE",
    category: skill.category ?? null,
    universal: skill.universal ?? false,
  };
}

export const mockSkills = (skillsMock.skills as LegacySkill[]).map(normalizeSkill);
