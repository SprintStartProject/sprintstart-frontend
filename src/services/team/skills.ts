import { apiClient } from "../apiClient";
import type { Skill, SkillStatus, SkillSuggestion } from "./featureTypes";
import { mockSkills } from "./mockData";

type SkillResponseDto = {
  id: string;
  name: string;
  status?: SkillStatus;
  category?: string | null;
  universal?: boolean;
  roleId?: string;
  roleIds?: string[];
  projectRole?: {
    id: string;
  };
};

function toSkill(skill: SkillResponseDto): Skill {
  const legacyRoleIds = skill.projectRole?.id
    ? [skill.projectRole.id]
    : skill.roleId
      ? [skill.roleId]
      : [];

  return {
    id: skill.id,
    name: skill.name,
    roleIds: skill.roleIds ?? legacyRoleIds,
    status: skill.status ?? "ACTIVE",
    category: skill.category ?? null,
    universal: skill.universal ?? false,
  };
}

/**
 * Lists all skills, retired ones included (see `status`).
 *
 * **Never throws.** When the request fails, it returns the mock skills instead.
 * {@link getUserSkillLevels} and {@link getMySkillLevels} label real assessments with this list,
 * so in that case they show mock skill names. The caller cannot tell this from a success; see
 * the mock fallbacks in `docs/testing_strategy.md` §8.
 */
export async function getSkills(): Promise<Skill[]> {
  try {
    const response = await apiClient.fetch<SkillResponseDto[]>("/api/v1/skills");

    return response.map(toSkill);
  } catch {
    return mockSkills;
  }
}

/**
 * Loads one skill.
 *
 * @throws ApiError 404 when the skill does not exist.
 */
export async function getSkillById(skillId: string): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>(`/api/v1/skills/${skillId}`);

  return toSkill(response);
}

export type UpdateSkillRequest = {
  name?: string;
  roleIds?: string[];
  /**
   * Required, not optional: the backend `PATCH` sets `category` to `null`
   * whenever it is missing from the body, so a caller that only means to
   * change the name or the roles must still resend the skill's current
   * category or silently clear it.
   */
  category: string | null;
  universal?: boolean;
};

/**
 * Renames a skill or changes the roles, category or universal flag of a skill through the admin
 * endpoint. ADMIN only; a PM or HR caller gets a 403.
 */
export async function updateSkill(skillId: string, data: UpdateSkillRequest): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>(`/api/v1/admin/skills/${skillId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  return toSkill(response);
}

export type SuggestSkillsContext = {
  projectId?: string;
  industry?: string;
};

type SkillSuggestionsResponseDto = {
  suggestions: SkillSuggestion[];
};

export type AcceptSkillSuggestionRequest = {
  skillId?: string;
  name?: string;
  category?: string | null;
};

/**
 * Requests reviewable AI suggestions without changing the role's persisted skills.
 *
 * Project context is optional. When supplied, the backend authorizes it before using
 * its industry and artifact corpus. Failures propagate so the review panel can show
 * an actionable error instead of pretending that the AI returned no suggestions.
 */
export async function suggestSkillsForRole(
  roleId: string,
  context?: SuggestSkillsContext,
): Promise<SkillSuggestion[]> {
  const hasContext = Boolean(context?.projectId || context?.industry);
  const response = await apiClient.fetch<SkillSuggestionsResponseDto>(
    `/api/v1/projectRoles/${roleId}/skills/suggest`,
    {
      method: "POST",
      ...(hasContext ? { body: JSON.stringify(context) } : {}),
    },
  );

  return response.suggestions;
}

/**
 * Persists one reviewed suggestion and returns the role's complete updated skill list.
 *
 * Existing catalog entries are accepted by ID. New suggestions are accepted by name
 * and optional category so the backend can create and link a non-universal skill.
 */
export async function acceptSkillSuggestion(
  roleId: string,
  request: AcceptSkillSuggestionRequest,
): Promise<Skill[]> {
  const response = await apiClient.fetch<SkillResponseDto[]>(
    `/api/v1/projectRoles/${roleId}/skills/suggestions/accept`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );

  return response.map(toSkill);
}

/** Lists the skills linked to one project role. */
export async function getSkillsByRoleId(roleId: string): Promise<Skill[]> {
  const response = await apiClient.fetch<SkillResponseDto[]>(
    `/api/v1/projectRoles/${roleId}/skills`,
  );

  return response.map(toSkill);
}

/**
 * Replaces the complete list of skills linked to a project role.
 *
 * @returns The role's skills after the change.
 */
export async function updateRoleSkills(roleId: string, skillIds: string[]): Promise<Skill[]> {
  const response = await apiClient.fetch<SkillResponseDto[]>(
    `/api/v1/projectRoles/${roleId}/skills`,
    {
      method: "PUT",
      body: JSON.stringify({ skillIds }),
    },
  );

  return response.map(toSkill);
}

/**
 * Brings a retired skill back. There is no reactivate endpoint: the backend reactivates a
 * retired skill when a skill with the same name is created, so this posts `name` and links it
 * to `roleIds`. ADMIN only; a PM or HR caller gets a 403.
 *
 * @param _skillId - Unused; the backend matches the retired skill by `name`.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function reactivateSkill(
  _skillId: string,
  name: string,
  roleIds: string[],
): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>("/api/v1/admin/skills", {
    method: "POST",
    body: JSON.stringify({
      name,
      roleIds,
    }),
  });

  return toSkill(response);
}

export type CreateSkillRequest = {
  name: string;
  roleIds: string[];
  category?: string | null;
  universal?: boolean;
};

/**
 * Creates a new skill, or reactivates a retired one of the same name, through the
 * admin endpoint. ADMIN only; a PM or HR caller gets a 403. A name that collides with
 * an already-active skill answers 409.
 */
export async function createSkill(request: CreateSkillRequest): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>("/api/v1/admin/skills", {
    method: "POST",
    body: JSON.stringify(request),
  });

  return toSkill(response);
}

/**
 * Retires a skill globally through the admin endpoint. The backend keeps it with status
 * `RETIRED` rather than deleting it, so it can be reactivated later. ADMIN only; a PM or HR
 * caller gets a 403.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function deleteSkill(skillId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/skills/${skillId}`, {
    method: "DELETE",
  });
}
