import { apiClient } from "./apiClient";
import teamOverviewMock from "../mocks/teamOverviewMock.json";
import skillsMock from "../mocks/skillsMock.json";
import type {
  ProjectRole,
  Skill,
  TeamOverviewUser,
  SkillLevel,
  SkillStatus,
} from "../features/team-management/types";
import type {
  OnboardingPhaseEndpoint,
  OnboardingPathEndpoint,
  OnboardingStepEndpoint,
  OnboardingTaskEndpoint,
  StepType,
} from "../features/onboarding/types";

let mockUsers = teamOverviewMock.users as TeamOverviewUser[];

let mockProjectRoles: ProjectRole[] = Array.from(
  new Map(
    mockUsers.flatMap((user) => user.roles).map((role) => [role.id, role]),
  ).values(),
);

type LegacySkill = {
  id: string;
  name: string;
  roleId?: string;
  roleIds?: string[];
  status?: SkillStatus;
};

function normalizeSkill(skill: LegacySkill): Skill {
  const roleIds = skill.roleIds ?? (skill.roleId ? [skill.roleId] : []);

  return {
    id: skill.id,
    name: skill.name,
    roleIds,
    status: skill.status ?? "ACTIVE",
  };
}

let mockSkills = (skillsMock.skills as LegacySkill[]).map(normalizeSkill);

export async function getTeamOverview(
  roleId?: string,
  sortBy?: string,
  projectIds?: string[],
): Promise<TeamOverviewUser[]> {
  try {
    const params = new URLSearchParams();
    if (roleId && roleId !== "all") params.append("roleIds", roleId);
    projectIds?.forEach((projectId) => params.append("projectIds", projectId));
    if (sortBy) params.append("sortBy", sortBy);
    params.append("size", "100");

    const query = params.toString();
    const url = `/api/v1/onboarding/team-overview${query ? `?${query}` : ""}`;

    const response = await apiClient.fetch<{ content: TeamOverviewUser[] }>(
      url,
    );

    const users = response.content.map((user) => ({
      ...user,
      roles: user.roles.map((role: ProjectRole & { roleId?: string }) => ({
        ...role,
        id: role.id || role.roleId || "",
      })),
    }));

    try {
      const feedback = await getAllOnboardingFeedback();
      const usersWithUnreadFeedback = new Set(
        feedback
          .filter((item) => item.read !== true && !item.readAt)
          .map((item) => item.userId)
          .filter((userId): userId is string => Boolean(userId)),
      );

      return users.map((user) => ({
        ...user,
        hasFeedback: usersWithUnreadFeedback.has(user.userId),
      }));
    } catch {
      return users;
    }
  } catch {
    return mockUsers;
  }
}

export async function getTeamMember(
  userId: string,
): Promise<TeamOverviewUser | undefined> {
  const users = await getTeamOverview();

  return users.find((user) => user.userId === userId);
}

export async function getMyTeamOverview(): Promise<TeamOverviewUser> {
  try {
    const user = await apiClient.fetch<TeamOverviewUser>(
      "/api/v1/onboarding/me/team-overview",
    );
    return {
      ...user,
      roles: user.roles.map((role: ProjectRole & { roleId?: string }) => ({
        ...role,
        id: role.id || role.roleId || "",
      })),
    };
  } catch {
    // Fallback to finding the first user in mock for development
    return mockUsers[0];
  }
}

export async function getProjectRoles(): Promise<ProjectRole[]> {
  try {
    const response = await apiClient.fetch<
      { projectRoles?: ProjectRole[] } | ProjectRole[]
    >("/api/v1/projectRoles");

    return Array.isArray(response) ? response : (response.projectRoles ?? []);
  } catch {
    return mockProjectRoles;
  }
}

export async function createProjectRole(
  name: string,
  description: string,
): Promise<ProjectRole> {
  try {
    return await apiClient.fetch<ProjectRole>("/api/v1/projectRoles", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
      }),
    });
  } catch {
    const newRole: ProjectRole = {
      id: `mock-role-${Date.now()}`,
      name,
      description,
    };

    mockProjectRoles = [...mockProjectRoles, newRole];

    return newRole;
  }
}

export async function assignProjectRoleToUser(
  userId: string,
  roleId: string,
): Promise<void> {
  try {
    await apiClient.fetch(`/api/v1/users/${userId}/project-roles`, {
      method: "POST",
      body: JSON.stringify({
        roleId: roleId,
      }),
    });

    return;
  } catch {
    const role = mockProjectRoles.find(
      (projectRole) => projectRole.id === roleId,
    );

    if (!role) return;

    mockUsers = mockUsers.map((user) => {
      if (user.userId !== userId) return user;

      const alreadyAssigned = user.roles.some(
        (userRole) => userRole.id === roleId,
      );

      if (alreadyAssigned) return user;

      return {
        ...user,
        roles: [...user.roles, role],
      };
    });
  }
}

export async function unassignProjectRoleFromUser(
  userId: string,
  roleId: string,
): Promise<void> {
  try {
    await apiClient.fetch(`/api/v1/users/${userId}/project-roles/${roleId}`, {
      method: "DELETE",
    });

    return;
  } catch {
    mockUsers = mockUsers.map((user) => {
      if (user.userId !== userId) return user;

      return {
        ...user,
        roles: user.roles.filter((role) => role.id !== roleId),
      };
    });
  }
}

/**
 * Anything that can change whether the PM dashboard still needs attention
 * announces itself here: deciding a skip request, or marking feedback read.
 *
 * A tiny emitter rather than a context, because the only listener is the
 * sidebar badge and the callers are plain service functions. Without it the
 * badge would keep bouncing until the next rate-limited check, long after the
 * user has dealt with the thing it was pointing at.
 */
type PmAttentionListener = () => void;

const pmAttentionListeners = new Set<PmAttentionListener>();

export function onPmAttentionChanged(listener: PmAttentionListener): () => void {
  pmAttentionListeners.add(listener);
  return () => {
    pmAttentionListeners.delete(listener);
  };
}

function notifyPmAttentionChanged(): void {
  pmAttentionListeners.forEach((listener) => {
    listener();
  });
}

export async function acceptOnboardingSkipRequest(
  skipId: string,
  reviewComment = "",
): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/skips/${skipId}/accept`, {
    method: "POST",
    body: JSON.stringify({
      reviewComment,
    }),
  });

  notifyPmAttentionChanged();
}

export async function denyOnboardingSkipRequest(
  skipId: string,
  reviewComment = "",
): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/skips/${skipId}/deny`, {
    method: "POST",
    body: JSON.stringify({
      reviewComment,
    }),
  });

  notifyPmAttentionChanged();
}

export type OnboardingFeedback = {
  id: string;
  userId?: string;
  stepId?: string | null;
  stepTitle?: string | null;
  message: string;
  comment?: string;
  helpful?: boolean | null;
  createdAt?: string;
  read?: boolean;
  readAt?: string | null;
};

export async function getUserOnboardingFeedback(
  userId: string,
): Promise<OnboardingFeedback[]> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>(
    `/api/v1/admin/onboarding/users/${userId}/feedback`,
  );

  return feedback.map((item) => ({
    ...item,
    message: item.message ?? item.comment ?? "",
  }));
}

export async function getAllOnboardingFeedback(): Promise<
  OnboardingFeedback[]
> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>(
    "/api/v1/admin/onboarding/feedback",
  );

  return feedback.map((item) => ({
    ...item,
    message: item.message ?? item.comment ?? "",
  }));
}

export async function markOnboardingFeedbackRead(
  feedbackId: string,
): Promise<void> {
  await apiClient.fetch(
    `/api/v1/admin/onboarding/feedback/${feedbackId}/read`,
    {
      method: "POST",
    },
  );

  notifyPmAttentionChanged();
}

export async function getUserOnboardingPath(
  userId: string,
): Promise<OnboardingPathEndpoint | null> {
  try {
    const path = await apiClient.fetch<OnboardingPathEndpoint>(
      `/api/v1/onboarding/users/${userId}/path`,
    );

    const phases =
      path.phases?.length > 0
        ? path.phases
        : await apiClient.fetch<OnboardingPhaseEndpoint[]>(
            `/api/v1/onboarding/users/${userId}/path/phases`,
          );

    const hydratedPhases = await Promise.all(
      phases.map(async (phase) => {
        if (phase.steps?.length > 0) return phase;

        try {
          const steps = await apiClient.fetch<OnboardingStepEndpoint[]>(
            `/api/v1/onboarding/phases/${phase.id}/steps`,
          );

          return {
            ...phase,
            steps,
          };
        } catch {
          return {
            ...phase,
            steps: [],
          };
        }
      }),
    );

    return {
      ...path,
      phases: hydratedPhases,
    };
  } catch {
    return null;
  }
}

export type CreateOnboardingStepRequest = {
  position: number;
  isAiAssisted?: boolean;
  title: string;
  description: string;
  type: StepType;
  estimatedMinutes: number;
  expectedOutcome?: string;
};

export type UpdateOnboardingStepRequest = CreateOnboardingStepRequest & {
  status?: string;
  skip?: unknown;
};

export type CreateOnboardingTaskRequest = {
  position: number;
  title: string;
  description: string;
  finished?: boolean;
};

export async function createOnboardingStepForPhase(
  phaseId: string,
  request: CreateOnboardingStepRequest,
): Promise<OnboardingStepEndpoint> {
  return await apiClient.fetch<OnboardingStepEndpoint>(
    `/api/v1/onboarding/phases/${phaseId}/steps`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

export async function updateOnboardingStep(
  stepId: string,
  request: UpdateOnboardingStepRequest,
): Promise<OnboardingStepEndpoint> {
  return await apiClient.fetch<OnboardingStepEndpoint>(`/api/v1/onboarding/steps/${stepId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function createOnboardingTaskForStep(
  stepId: string,
  request: CreateOnboardingTaskRequest,
): Promise<OnboardingTaskEndpoint> {
  return await apiClient.fetch<OnboardingTaskEndpoint>(
    `/api/v1/onboarding/steps/${stepId}/tasks`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}

export async function deleteOnboardingStep(stepId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/onboarding/steps/${stepId}`, {
    method: "DELETE",
  });
}

export type UpdateOnboardingTaskRequest = {
  position: number;
  title: string;
  description: string;
  finished: boolean;
};

/**
 * Updates an onboarding task, including its position. Used by the drag-and-drop
 * task reordering in the team member detail view. The backend automatically
 * shifts sibling tasks within the same step when the position changes.
 */
export async function updateOnboardingTask(
  taskId: string,
  request: UpdateOnboardingTaskRequest,
): Promise<OnboardingTaskEndpoint> {
  return await apiClient.fetch<OnboardingTaskEndpoint>(`/api/v1/onboarding/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function getOnboardingTasksByStep(
  stepId: string,
): Promise<OnboardingTaskEndpoint[]> {
  try {
    return await apiClient.fetch<OnboardingTaskEndpoint[]>(
      `/api/v1/onboarding/steps/${stepId}/tasks`,
    );
  } catch {
    return [];
  }
}

export async function deleteOnboardingTask(taskId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/onboarding/tasks/${taskId}`, {
    method: "DELETE",
  });
}

type SkillResponseDto = {
  id: string;
  name: string;
  status?: SkillStatus;
  roleId?: string;
  roleIds?: string[];
  projectRole?: {
    id: string;
  };
};

type SkillAssessmentResponseDto = {
  id?: string;
  userId: string;
  skillId: string;
  level: SkillLevel;
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
  };
}

export async function getSkills(): Promise<Skill[]> {
  try {
    const response =
      await apiClient.fetch<SkillResponseDto[]>("/api/v1/skills");

    return response.map(toSkill);
  } catch {
    return mockSkills;
  }
}

export async function getSkillById(skillId: string): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>(
    `/api/v1/skills/${skillId}`,
  );

  return toSkill(response);
}

export async function updateSkill(
  skillId: string,
  data: { name?: string; roleIds?: string[] },
): Promise<Skill> {
  const response = await apiClient.fetch<SkillResponseDto>(
    `/api/v1/admin/skills/${skillId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );

  return toSkill(response);
}

export async function getSkillsByRoleId(roleId: string): Promise<Skill[]> {
  const response = await apiClient.fetch<SkillResponseDto[]>(
    `/api/v1/projectRoles/${roleId}/skills`,
  );

  return response.map(toSkill);
}

export async function updateRoleSkills(
  roleId: string,
  skillIds: string[],
): Promise<Skill[]> {
  const response = await apiClient.fetch<SkillResponseDto[]>(
    `/api/v1/projectRoles/${roleId}/skills`,
    {
      method: "PUT",
      body: JSON.stringify({ skillIds }),
    },
  );

  return response.map(toSkill);
}

export async function reactivateSkill(
  skillId: string,
  name: string,
  roleIds: string[],
): Promise<Skill> {
  try {
    const response = await apiClient.fetch<SkillResponseDto>(
      "/api/v1/admin/skills",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          roleIds,
        }),
      },
    );

    return toSkill(response);
  } catch {
    mockSkills = mockSkills.map((s) =>
      s.id === skillId ? { ...s, status: "ACTIVE" as const } : s,
    );

    return (
      mockSkills.find((s) => s.id === skillId) ?? {
        id: skillId,
        name,
        roleIds,
        status: "ACTIVE",
      }
    );
  }
}

export async function createSkill(
  name: string,
  roleIds: string[],
): Promise<Skill> {
  try {
    const response = await apiClient.fetch<SkillResponseDto>(
      "/api/v1/admin/skills",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          roleIds,
        }),
      },
    );

    return toSkill(response);
  } catch {
    const existing = mockSkills.find(
      (s) =>
        s.name.toLowerCase() === name.toLowerCase() && s.status === "RETIRED",
    );

    if (existing) {
      const reactivated: Skill = { ...existing, roleIds, status: "ACTIVE" };

      mockSkills = mockSkills.map((s) =>
        s.id === existing.id ? reactivated : s,
      );

      return reactivated;
    }

    const newSkill: Skill = {
      id: `mock-skill-${Date.now()}`,
      name,
      roleIds,
      status: "ACTIVE",
    };

    mockSkills = [...mockSkills, newSkill];

    return newSkill;
  }
}

export async function deleteProjectRole(roleId: string): Promise<void> {
  try {
    await apiClient.fetch(`/api/v1/projectRoles/${roleId}`, {
      method: "DELETE",
    });

    return;
  } catch {
    mockProjectRoles = mockProjectRoles.filter((role) => role.id !== roleId);

    mockSkills = mockSkills.map((skill) => ({
      ...skill,
      roleIds: skill.roleIds.filter((linkedRoleId) => linkedRoleId !== roleId),
    }));

    mockUsers = mockUsers.map((user) => ({
      ...user,
      roles: user.roles.filter((role) => role.id !== roleId),
    }));
  }
}

export async function deleteSkill(skillId: string): Promise<void> {
  try {
    await apiClient.fetch(`/api/v1/admin/skills/${skillId}`, {
      method: "DELETE",
    });

    return;
  } catch {
    mockSkills = mockSkills.map((skill) =>
      skill.id === skillId ? { ...skill, status: "RETIRED" } : skill,
    );
  }
}

// Removed mock role functions

export type CreateSkillAssessmentRequest = {
  userId: string;
  skillId: string;
  level: SkillLevel;
};

let mockSkillAssessments: CreateSkillAssessmentRequest[] = [];

const skillAssessmentPromptStatePrefix = "skill-assessment-prompt-state";

export type SkillAssessmentPromptState = "dismissed" | "completed";

function getSkillAssessmentPromptStateKey(userId: string) {
  return `${skillAssessmentPromptStatePrefix}:${userId}`;
}

export function getSkillAssessmentPromptState(
  userId: string,
): SkillAssessmentPromptState | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(
    getSkillAssessmentPromptStateKey(userId),
  );

  return value === "dismissed" || value === "completed" ? value : null;
}

export function markSkillAssessmentPromptDismissed(userId: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getSkillAssessmentPromptStateKey(userId),
    "dismissed",
  );
}

export function markSkillAssessmentPromptCompleted(userId: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getSkillAssessmentPromptStateKey(userId),
    "completed",
  );
}

export async function hasCompletedSkillAssessment(
  userId: string,
): Promise<boolean> {
  try {
    const response =
      await apiClient.fetch<SkillAssessmentResponseDto[]>("/api/v1/me/skills");

    return response.length > 0;
  } catch {
    return mockSkillAssessments.some(
      (assessment) => assessment.userId === userId,
    );
  }
}

export async function saveUserSkillAssessments(
  assessments: CreateSkillAssessmentRequest[],
): Promise<void> {
  try {
    for (const assessment of assessments) {
      await apiClient.fetch("/api/v1/me/skill/assess", {
        method: "POST",
        body: JSON.stringify({
          skillId: assessment.skillId,
          level: assessment.level,
        }),
      });
    }
  } catch {
    mockSkillAssessments = mockSkillAssessments.filter(
      (assessment) =>
        !assessments.some(
          (incoming) =>
            incoming.userId === assessment.userId &&
            incoming.skillId === assessment.skillId,
        ),
    );

    mockSkillAssessments = [...mockSkillAssessments, ...assessments];
  }
}

export type UserSkillLevel = {
  id: string;
  skillId: string;
  skillName: string;
  roleName: string;
  level: SkillLevel;
};

async function getCompletedSkillAssessments(
  userId: string,
): Promise<SkillAssessmentResponseDto[]> {
  return await apiClient.fetch<SkillAssessmentResponseDto[]>(
    `/api/v1/admin/users/${userId}/skill-assessments/completed`,
  );
}

export async function getUserSkillLevels(
  userId: string,
): Promise<UserSkillLevel[]> {
  try {
    const [assessments, skills, roles] = await Promise.all([
      getCompletedSkillAssessments(userId),
      getSkills(),
      getProjectRoles(),
    ]);

    return assessments.map((assessment) => {
      const skill = skills.find((s) => s.id === assessment.skillId);
      const roleNames = roles
        .filter((role) => skill?.roleIds.includes(role.id))
        .map((role) => role.name);

      return {
        id: `${userId}-${assessment.skillId}`,
        skillId: assessment.skillId,
        skillName: skill?.name ?? "Unknown skill",
        roleName: roleNames.length > 0 ? roleNames.join(", ") : "Unknown role",
        level: assessment.level,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Skill levels for the *currently authenticated* user.
 *
 * Mirrors {@link getUserSkillLevels} but reads `/api/v1/me/skills`, which is
 * open to the USER role — the admin endpoint behind `getUserSkillLevels`
 * would 403 for a regular user looking at their own dashboard. The raw
 * assessments only carry skill IDs, so names and roles are joined in from
 * the skill and project-role lists.
 */
export async function getMySkillLevels(): Promise<UserSkillLevel[]> {
  try {
    const [assessments, skills, roles] = await Promise.all([
      apiClient.fetch<SkillAssessmentResponseDto[]>("/api/v1/me/skills"),
      getSkills(),
      getProjectRoles(),
    ]);

    return assessments.map((assessment) => {
      const skill = skills.find((s) => s.id === assessment.skillId);
      const roleNames = roles
        .filter((role) => skill?.roleIds.includes(role.id))
        .map((role) => role.name);

      return {
        id: `${assessment.userId}-${assessment.skillId}`,
        skillId: assessment.skillId,
        skillName: skill?.name ?? "Unknown skill",
        roleName: roleNames.length > 0 ? roleNames.join(", ") : "Unknown role",
        level: assessment.level,
      };
    });
  } catch {
    return [];
  }
}
