import { apiClient } from "./apiClient";
import teamOverviewMock from "../mocks/teamOverviewMock.json";
import skillsMock from "../mocks/skillsMock.json";
import type {
  ProjectRole,
  Skill,
  SkillSuggestion,
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

// The fixture predates the `projects` list and still carries a single
// `project`, so it goes through the same normalization as an API response.
let mockUsers = (teamOverviewMock.users as unknown as BackendTeamOverviewUser[]).map((user) => ({
  ...user,
  projects: toTeamOverviewProjects(user),
}));

let mockProjectRoles: ProjectRole[] = Array.from(
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

let mockSkills = (skillsMock.skills as LegacySkill[]).map(normalizeSkill);

/**
 * Team-overview user as the API actually sends it.
 *
 * The projects arrive under `projectIds` as objects keyed by `projectId`. The
 * older single `project` shape is still accepted because fixtures and the
 * `me/team-overview` endpoint use it.
 */
type BackendTeamOverviewUser = Omit<TeamOverviewUser, "projects"> & {
  projectIds?: { projectId?: string; id?: string; name?: string }[];
  project?: { id?: string; name?: string };
};

/** Normalizes whichever project shape the API returned into `projects`. */
function toTeamOverviewProjects(user: BackendTeamOverviewUser): TeamOverviewUser["projects"] {
  const fromList = (user.projectIds ?? []).flatMap((project) => {
    const id = project.projectId ?? project.id;

    return id ? [{ id, name: project.name ?? "" }] : [];
  });

  if (fromList.length > 0) return fromList;

  return user.project?.id ? [{ id: user.project.id, name: user.project.name ?? "" }] : [];
}

/** The team overview as the backend has it, without the unread-feedback flag. Throws on failure. */
async function readTeamOverviewUsers(
  roleId?: string,
  sortBy?: string,
  projectIds?: string[],
): Promise<TeamOverviewUser[]> {
  const params = new URLSearchParams();
  if (roleId && roleId !== "all") params.append("roleIds", roleId);
  projectIds?.forEach((projectId) => params.append("projectIds", projectId));
  if (sortBy) params.append("sortBy", sortBy);
  params.append("size", "100");

  const query = params.toString();
  const url = `/api/v1/onboarding/team-overview${query ? `?${query}` : ""}`;

  const response = await apiClient.fetch<{
    content: BackendTeamOverviewUser[];
  }>(url);

  return response.content.map((user) => ({
    ...user,
    projects: toTeamOverviewProjects(user),
    roles: user.roles.map((role: ProjectRole & { roleId?: string }) => ({
      ...role,
      id: role.id || role.roleId || "",
    })),
  }));
}

/** Sets `hasFeedback` on every member with at least one feedback item nobody has read. */
function withUnreadFeedbackFlag(
  users: TeamOverviewUser[],
  feedback: OnboardingFeedback[],
): TeamOverviewUser[] {
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
}

/**
 * The team overview, each member flagged when they have unread feedback.
 *
 * Forgiving on purpose, for the screens that list the team: if the feedback list cannot be read
 * the members come without the flag, and if the overview itself cannot be read this falls back to
 * mock users. Anything that draws conclusions from the answer — a count, a finding — must use
 * {@link getTeamOverviewOrThrow} instead, which never invents members.
 */
export async function getTeamOverview(
  roleId?: string,
  sortBy?: string,
  projectIds?: string[],
): Promise<TeamOverviewUser[]> {
  let users: TeamOverviewUser[];
  try {
    users = await readTeamOverviewUsers(roleId, sortBy, projectIds);
  } catch {
    return mockUsers;
  }

  try {
    return withUnreadFeedbackFlag(users, await getAllOnboardingFeedback());
  } catch {
    return users;
  }
}

/**
 * {@link getTeamOverview} without the fallbacks: the same members and the same unread-feedback
 * flag, but it throws when the overview or the feedback list cannot be read.
 *
 * For the project analysis, which turns the answer into findings and a score: made-up members
 * would become findings about people who do not exist, and a missing feedback list would read as
 * "nothing unread". A failure has to reach the caller, so the check is marked as not run.
 */
export async function getTeamOverviewOrThrow(projectIds: string[]): Promise<TeamOverviewUser[]> {
  const [users, feedback] = await Promise.all([
    readTeamOverviewUsers(undefined, undefined, projectIds),
    getAllOnboardingFeedback(),
  ]);
  return withUnreadFeedbackFlag(users, feedback);
}

/**
 * One member's row from the team overview, or `undefined` when they are not in it.
 *
 * Reads the whole overview through {@link getTeamOverview}, so it inherits its fallback: when
 * the backend is unreachable, the member is looked up among the mock users.
 */
export async function getTeamMember(userId: string): Promise<TeamOverviewUser | undefined> {
  const users = await getTeamOverview();

  return users.find((user) => user.userId === userId);
}

/**
 * The signed-in user's own row of the team overview: their roles, skills and position in
 * their onboarding.
 *
 * Failures propagate. This used to answer with the first mock user instead, which is
 * indistinguishable from a real reply — so a user with no onboarding path (404) or a role
 * that may not read the overview at all (403) was handed somebody else's journey, and the
 * dashboard reported an onboarding that did not exist. Callers decide what an absent
 * overview means for them; a fixture cannot make that decision for them.
 */
export async function getMyTeamOverview(): Promise<TeamOverviewUser> {
  const user = await apiClient.fetch<BackendTeamOverviewUser>(
    "/api/v1/onboarding/me/team-overview",
  );

  return {
    ...user,
    projects: toTeamOverviewProjects(user),
    roles: user.roles.map((role: ProjectRole & { roleId?: string }) => ({
      ...role,
      id: role.id || role.roleId || "",
    })),
  };
}

/**
 * Lists all project roles.
 *
 * **Never throws.** When the request fails, it returns the roles of the mock users instead. The
 * caller cannot tell this from a success; see the mock fallbacks in `docs/testing_strategy.md` §8.
 */
export async function getProjectRoles(): Promise<ProjectRole[]> {
  try {
    const response = await apiClient.fetch<{ projectRoles?: ProjectRole[] } | ProjectRole[]>(
      "/api/v1/projectRoles",
    );

    return Array.isArray(response) ? response : (response.projectRoles ?? []);
  } catch {
    return mockProjectRoles;
  }
}

/**
 * Creates a project role.
 *
 * **Never throws.** When the request fails, it adds the role to the in-memory mock list and returns
 * it with a made-up `mock-role-…` id, which later calls with that id will not find on the backend.
 * The caller cannot tell this from a success; see the mock fallbacks in
 * `docs/testing_strategy.md` §8.
 */
export async function createProjectRole(name: string, description: string): Promise<ProjectRole> {
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

/**
 * Gives a user a project role.
 *
 * **Never throws.** When the request fails, it adds the role to that user among the in-memory mock
 * users instead. The caller cannot tell this from a success; see the mock fallbacks in
 * `docs/testing_strategy.md` §8.
 */
export async function assignProjectRoleToUser(userId: string, roleId: string): Promise<void> {
  try {
    await apiClient.fetch(`/api/v1/users/${userId}/project-roles`, {
      method: "POST",
      body: JSON.stringify({
        roleId: roleId,
      }),
    });

    return;
  } catch {
    const role = mockProjectRoles.find((projectRole) => projectRole.id === roleId);

    if (!role) return;

    mockUsers = mockUsers.map((user) => {
      if (user.userId !== userId) return user;

      const alreadyAssigned = user.roles.some((userRole) => userRole.id === roleId);

      if (alreadyAssigned) return user;

      return {
        ...user,
        roles: [...user.roles, role],
      };
    });
  }
}

/**
 * Takes a project role away from a user.
 *
 * **Never throws.** When the request fails, it removes the role from that user among the in-memory
 * mock users instead. The caller cannot tell this from a success; see the mock fallbacks in
 * `docs/testing_strategy.md` §8.
 */
export async function unassignProjectRoleFromUser(userId: string, roleId: string): Promise<void> {
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

/** What waits on the project manager in one project, as the sidebar counts it. */
export type PmAttentionCount = {
  /** Members whose current step has a skip request nobody has decided yet. */
  pendingSkips: number;
  /** Feedback items from the project's members that nobody has marked read. */
  unreadFeedback: number;
  total: number;
};

/**
 * How many onboarding items wait on the project manager in one project: pending skip requests
 * plus unread feedback, each counted from the backend's own answers.
 *
 * TODO(backend): there is no endpoint that answers "how many" yet, so this reads the two lists
 * that know -- the project's team overview (a pending skip rides on the member's current step)
 * and the feedback list, narrowed to the project's members since it is not scoped by project.
 * Kept in one function so a count endpoint can replace the body without touching a caller.
 *
 * Unlike {@link getTeamOverview} it never falls back to mock users, and it throws when either
 * read fails: a badge built from made-up members or half an answer is a wrong number, and the
 * caller shows no number rather than that.
 */
export async function getPmAttentionCount(projectId: string): Promise<PmAttentionCount> {
  const params = new URLSearchParams();
  params.append("projectIds", projectId);
  params.append("size", "100");

  const [overview, feedback] = await Promise.all([
    apiClient.fetch<{ content: BackendTeamOverviewUser[] }>(
      `/api/v1/onboarding/team-overview?${params.toString()}`,
    ),
    getAllOnboardingFeedback(),
  ]);

  const memberIds = new Set(overview.content.map((user) => user.userId));
  const pendingSkips = overview.content.filter(
    (user) => user.currentStep?.skip?.status === "PENDING",
  ).length;
  const unreadFeedback = feedback.filter(
    (item) => !item.read && item.userId !== undefined && memberIds.has(item.userId),
  ).length;

  return { pendingSkips, unreadFeedback, total: pendingSkips + unreadFeedback };
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

/**
 * Subscribes to changes of what waits on the project manager.
 *
 * @returns A function that removes the listener again.
 */
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

/**
 * Accepts a hire's request to skip their current step. PM and ADMIN only.
 *
 * @param reviewComment - Optional note for the hire about the decision.
 */
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

/**
 * Denies a hire's request to skip their current step. PM and ADMIN only.
 *
 * @param reviewComment - Optional note for the hire about the decision.
 */
export async function denyOnboardingSkipRequest(skipId: string, reviewComment = ""): Promise<void> {
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

/**
 * Feedback as the rest of the app may assume it: a message that is there, and a `read` that is a
 * definite boolean rather than absent.
 *
 * `read` being optional is what let three different readings of "unread" grow -- `read !== true`,
 * `read === false` -- which disagreed exactly when the backend omitted the field: one surface
 * offered "Mark read" on an item another surface was already calling read.
 */
function normaliseFeedback(item: OnboardingFeedback): OnboardingFeedback {
  return {
    ...item,
    message: item.message ?? item.comment ?? "",
    read: item.read ?? !!item.readAt,
  };
}

/** Loads all step feedback one user has given, with `read` normalised. PM and ADMIN only. */
export async function getUserOnboardingFeedback(userId: string): Promise<OnboardingFeedback[]> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>(
    `/api/v1/admin/onboarding/users/${userId}/feedback`,
  );

  return feedback.map(normaliseFeedback);
}

/**
 * Loads the step feedback of all users, across every project, with `read` normalised. Callers
 * that need one project's feedback filter by its members themselves. PM and ADMIN only.
 */
export async function getAllOnboardingFeedback(): Promise<OnboardingFeedback[]> {
  const feedback = await apiClient.fetch<OnboardingFeedback[]>("/api/v1/admin/onboarding/feedback");

  return feedback.map(normaliseFeedback);
}

/** Marks one feedback item as read. PM and ADMIN only. */
export async function markOnboardingFeedbackRead(feedbackId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/onboarding/feedback/${feedbackId}/read`, {
    method: "POST",
  });

  notifyPmAttentionChanged();
}

/**
 * One member's onboarding path, for a reviewer looking at it.
 *
 * The endpoint now answers with the path *as its owner has it* — phases with their steps and their
 * questions, each carrying that member's own status — so the hydration below is a fallback for a
 * thin response rather than the normal road it used to be.
 *
 * **Every phase is normalised before it leaves here**, and that is the part worth keeping. The
 * absence of `questions` on a phase took the whole team page down with a TypeError the moment
 * questions became first-class members of a phase: three surfaces read `phase.questions` because the
 * type promised it, and the wire did not deliver it. A missing array is filled at the boundary where
 * untrusted JSON becomes a typed object — which is the only place a default belongs, and the reason
 * no caller downstream has to defend itself against the same thing again.
 *
 * @returns The path, or `null` when the path cannot be loaded at all (including when the user
 *   has none). A phase whose steps fail to load is returned with an empty step list.
 */
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
        // Questions cannot be hydrated the way steps can: no endpoint hands out one member's
        // questions with their status. An empty list is the honest stand-in, and it keeps the page
        // standing instead of taking it down.
        const normalised = { ...phase, questions: phase.questions ?? [] };
        if (normalised.steps?.length > 0) return normalised;

        try {
          const steps = await apiClient.fetch<OnboardingStepEndpoint[]>(
            `/api/v1/onboarding/phases/${phase.id}/steps`,
          );

          return { ...normalised, steps };
        } catch {
          return { ...normalised, steps: [] };
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

/** Adds a step to a phase of a member's onboarding path. */
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

/** Replaces a step on a member's onboarding path, including its status and skip state. */
export async function updateOnboardingStep(
  stepId: string,
  request: UpdateOnboardingStepRequest,
): Promise<OnboardingStepEndpoint> {
  return await apiClient.fetch<OnboardingStepEndpoint>(`/api/v1/onboarding/steps/${stepId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/** Adds a task to a step of a member's onboarding path. */
export async function createOnboardingTaskForStep(
  stepId: string,
  request: CreateOnboardingTaskRequest,
): Promise<OnboardingTaskEndpoint> {
  return await apiClient.fetch<OnboardingTaskEndpoint>(`/api/v1/onboarding/steps/${stepId}/tasks`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Deletes a step from a member's onboarding path. */
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

/**
 * Loads the tasks of one step on a member's onboarding path.
 *
 * Never throws: when the request fails it returns an empty list, which looks the same as a step
 * without tasks.
 */
export async function getOnboardingTasksByStep(stepId: string): Promise<OnboardingTaskEndpoint[]> {
  try {
    return await apiClient.fetch<OnboardingTaskEndpoint[]>(
      `/api/v1/onboarding/steps/${stepId}/tasks`,
    );
  } catch {
    return [];
  }
}

/** Deletes a task from a member's onboarding path. */
export async function deleteOnboardingTask(taskId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/onboarding/tasks/${taskId}`, {
    method: "DELETE",
  });
}

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
 * Deletes a project role.
 *
 * **Never throws.** When the request fails, it removes the role from the in-memory mock roles,
 * skills and users instead. The caller cannot tell this from a success; see the mock fallbacks in
 * `docs/testing_strategy.md` §8.
 */
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

/**
 * Retires a skill globally through the admin endpoint. The backend keeps it with status
 * `RETIRED` rather than deleting it, so it can be reactivated later. ADMIN only; a PM or HR
 * caller gets a 403.
 */
export async function deleteSkill(skillId: string): Promise<void> {
  await apiClient.fetch(`/api/v1/admin/skills/${skillId}`, {
    method: "DELETE",
  });
}

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
 * **Never throws.** When the request fails, including halfway through the list, it stores the
 * assessments in the in-memory mock list instead. `SkillWizardPage` relies on this function
 * throwing to keep the wizard open, so a failed save is reported to the user as saved. The caller
 * cannot tell this from a success; see the mock fallbacks in `docs/testing_strategy.md` §8.
 */
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
            incoming.userId === assessment.userId && incoming.skillId === assessment.skillId,
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
 * @param roles - The signed-in user's own project roles, used to label each skill. Pass an
 *   empty list when they are not known yet — the labels degrade, the call does not fail.
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
