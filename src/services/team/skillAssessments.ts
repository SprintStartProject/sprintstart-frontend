import { apiClient } from "../apiClient";
import type { Skill, SkillLevel } from "./featureTypes";
import { getProjectRoles } from "./projectRoles";
import { getSkills } from "./skills";

type SkillAssessmentResponseDto = {
  id?: string;
  userId: string;
  skillId: string;
  level: SkillLevel;
};

export type CreateSkillAssessmentRequest = {
  userId: string;
  skillId: string;
  level: SkillLevel;
};

const mockSkillAssessments: CreateSkillAssessmentRequest[] = [];

const skillAssessmentPromptStatePrefix = "skill-assessment-prompt-state";

export type SkillAssessmentPromptState = "dismissed" | "completed";

function getSkillAssessmentPromptStateKey(userId: string) {
  return `${skillAssessmentPromptStatePrefix}:${userId}`;
}

/**
 * Whether a user has dismissed or completed the skill assessment prompt, as stored in this
 * browser's `localStorage`. `null` means neither, so `AuthGuard` may still send them to
 * `/skill-wizard`.
 */
export function getSkillAssessmentPromptState(userId: string): SkillAssessmentPromptState | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(getSkillAssessmentPromptStateKey(userId));

  return value === "dismissed" || value === "completed" ? value : null;
}

/** Remembers in `localStorage` that a user closed the skill assessment without finishing it. */
export function markSkillAssessmentPromptDismissed(userId: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getSkillAssessmentPromptStateKey(userId), "dismissed");
}

/** Remembers in `localStorage` that a user finished the skill assessment. */
export function markSkillAssessmentPromptCompleted(userId: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(getSkillAssessmentPromptStateKey(userId), "completed");
}

/**
 * Whether the signed-in user has assessed at least one skill.
 *
 * The request always reads the signed-in user's own assessments; `userId` is only used by the
 * fallback.
 *
 * **Never throws.** When the request fails, it answers from the in-memory mock assessments, which
 * are empty after a reload. The caller cannot tell this from a success; see the mock fallbacks in
 * `docs/testing_strategy.md` §8.
 */
export async function hasCompletedSkillAssessment(userId: string): Promise<boolean> {
  try {
    const response = await apiClient.fetch<SkillAssessmentResponseDto[]>("/api/v1/me/skills");

    return response.length > 0;
  } catch {
    return mockSkillAssessments.some((assessment) => assessment.userId === userId);
  }
}

/**
 * Saves the signed-in user's skill assessments, one request per skill, in order.
 *
 * No mock fallback: answering a failed write by changing the mock data told the caller it worked
 * while the backend never changed — and the next reload undid it. A failure reaches the caller,
 * which says so.
 */
export async function saveUserSkillAssessments(
  assessments: CreateSkillAssessmentRequest[],
): Promise<void> {
  for (const assessment of assessments) {
    await apiClient.fetch("/api/v1/me/skill/assess", {
      method: "POST",
      body: JSON.stringify({
        skillId: assessment.skillId,
        level: assessment.level,
      }),
    });
  }
}

export type UserSkillLevel = {
  id: string;
  skillId: string;
  skillName: string;
  roleName: string;
  level: SkillLevel;
};

async function getCompletedSkillAssessments(userId: string): Promise<SkillAssessmentResponseDto[]> {
  return await apiClient.fetch<SkillAssessmentResponseDto[]>(
    `/api/v1/admin/users/${userId}/skill-assessments/completed`,
  );
}

/**
 * Turns completed assessments into the rows both skill-level readers return.
 *
 * An assessment carries a skill ID and nothing else, so the skill name comes from the
 * skill list and the role label from whatever role names the caller has to hand: the
 * admin role list on the team-management side, the signed-in user's own profile roles
 * on the dashboard side.
 */
function joinSkillLevels(
  assessments: SkillAssessmentResponseDto[],
  skills: Skill[],
  roles: readonly { id: string; name: string }[],
  idFor: (assessment: SkillAssessmentResponseDto) => string,
): UserSkillLevel[] {
  return assessments.map((assessment) => {
    const skill = skills.find((s) => s.id === assessment.skillId);
    const roleNames = roles
      .filter((role) => skill?.roleIds.includes(role.id))
      .map((role) => role.name);

    return {
      id: idFor(assessment),
      skillId: assessment.skillId,
      skillName: skill?.name ?? "Unknown skill",
      roleName: roleNames.length > 0 ? roleNames.join(", ") : "Unknown role",
      level: assessment.level,
    };
  });
}

/**
 * Another user's completed skill assessments, each labelled with its skill and role names.
 *
 * Never throws: when the assessments cannot be read it returns an empty list, which looks the
 * same as a user who has not assessed anything. Skill and role names come from
 * {@link getSkills} and {@link getProjectRoles}, which fall back to mock data on failure.
 */
export async function getUserSkillLevels(userId: string): Promise<UserSkillLevel[]> {
  try {
    const [assessments, skills, roles] = await Promise.all([
      getCompletedSkillAssessments(userId),
      getSkills(),
      getProjectRoles(),
    ]);

    return joinSkillLevels(
      assessments,
      skills,
      roles,
      (assessment) => `${userId}-${assessment.skillId}`,
    );
  } catch {
    return [];
  }
}

/**
 * Skill levels for the *currently authenticated* user.
 *
 * Reads `/api/v1/me/skills`, which is open to the USER role — the admin endpoint behind
 * `getUserSkillLevels` 403s for a regular user looking at their own dashboard, and so
 * does `/api/v1/projectRoles`. That is why the role names are passed in rather than
 * looked up: the caller already holds the user's own profile roles from `/users/me`, so
 * no request is spent on resolving them. A skill pointing at a role the user does not
 * hold labels itself "Unknown role" rather than borrowing another project's list.
 *
 * @param roles - The signed-in user's own project roles, for labelling each skill. Pass an
 *   empty list when they are not known — the labels degrade, the call does not fail.
 */
export async function getMySkillLevels(
  roles: readonly { id: string; name: string }[],
): Promise<UserSkillLevel[]> {
  try {
    const [assessments, skills] = await Promise.all([
      apiClient.fetch<SkillAssessmentResponseDto[]>("/api/v1/me/skills"),
      getSkills(),
    ]);

    return joinSkillLevels(
      assessments,
      skills,
      roles,
      (assessment) => `${assessment.userId}-${assessment.skillId}`,
    );
  } catch {
    return [];
  }
}
