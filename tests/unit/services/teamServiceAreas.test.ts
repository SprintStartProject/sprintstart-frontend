import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../setup/vitest.setup";
import {
  acceptOnboardingSkipRequest,
  createOnboardingStepForPhase,
  createOnboardingTaskForStep,
  deleteOnboardingStep,
  deleteOnboardingTask,
  denyOnboardingSkipRequest,
  getAllOnboardingFeedback,
  getMyTeamOverview,
  getOnboardingTasksByStep,
  getProjectRoles,
  getSkillAssessmentPromptState,
  getSkills,
  getTeamMember,
  getTeamOverview,
  getUserOnboardingFeedback,
  getUserOnboardingPath,
  getUserSkillLevels,
  hasCompletedSkillAssessment,
  markOnboardingFeedbackRead,
  markSkillAssessmentPromptCompleted,
  markSkillAssessmentPromptDismissed,
  onPmAttentionChanged,
  unassignProjectRoleFromUser,
  updateOnboardingStep,
  updateOnboardingTask,
  getMySkillLevels,
} from "../../../src/services/teamManagementService";
import {
  normalizeOverviewUser,
  toTeamOverviewProjects,
} from "../../../src/services/team/overviewShape";
import { mockProjectRoles, mockSkills, mockUsers } from "../../../src/services/team/mockData";

const fail = () => new HttpResponse(null, { status: 500 });

describe("overview shape", () => {
  it("reads the projects from the list, by projectId or id, with an empty name by default", () => {
    const projects = toTeamOverviewProjects({
      projectIds: [{ projectId: "p1", name: "Alpha" }, { id: "p2" }, { name: "no id" }],
    } as never);

    expect(projects).toEqual([
      { id: "p1", name: "Alpha" },
      { id: "p2", name: "" },
    ]);
  });

  it("falls back to the single project of the older shape", () => {
    expect(toTeamOverviewProjects({ project: { id: "p9", name: "Old" } } as never)).toEqual([
      { id: "p9", name: "Old" },
    ]);
    expect(toTeamOverviewProjects({ project: { id: "p9" } } as never)).toEqual([
      { id: "p9", name: "" },
    ]);
  });

  it("prefers the list over the single project, and is empty without either", () => {
    expect(
      toTeamOverviewProjects({
        projectIds: [{ projectId: "a" }],
        project: { id: "b" },
      } as never),
    ).toEqual([{ id: "a", name: "" }]);
    expect(toTeamOverviewProjects({ projectIds: [] } as never)).toEqual([]);
    expect(toTeamOverviewProjects({ project: {} } as never)).toEqual([]);
  });

  it("gives a role its id from roleId when the id is missing", () => {
    const user = normalizeOverviewUser({
      userId: "u1",
      projectIds: [{ projectId: "p1", name: "Alpha" }],
      roles: [{ id: "r1", name: "Kept" }, { roleId: "r2", name: "Renamed" }, { name: "Nothing" }],
    } as never);

    expect(user.projects).toEqual([{ id: "p1", name: "Alpha" }]);
    expect(user.roles.map((role) => role.id)).toEqual(["r1", "r2", ""]);
  });
});

describe("fixtures", () => {
  it("normalize the older fixture shapes", () => {
    expect(mockUsers.length).toBeGreaterThan(0);
    expect(mockUsers.every((user) => Array.isArray(user.projects))).toBe(true);
    expect(mockSkills.length).toBeGreaterThan(0);
    expect(
      mockSkills.every(
        (skill) =>
          Array.isArray(skill.roleIds) &&
          skill.status === "ACTIVE" &&
          skill.universal === false &&
          skill.category === null,
      ),
    ).toBe(true);
  });

  it("list every role of the mock users once", () => {
    const ids = mockProjectRoles.map((role) => role.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("what waits on the project manager announces itself", () => {
  beforeEach(() => {
    server.use(
      http.post("/api/v1/admin/onboarding/skips/:id/accept", () => HttpResponse.json({})),
      http.post("/api/v1/admin/onboarding/skips/:id/deny", () => HttpResponse.json({})),
      http.post("/api/v1/admin/onboarding/feedback/:id/read", () => HttpResponse.json({})),
    );
  });

  it("tells a listener when a skip request is accepted, denied or feedback is read", async () => {
    const listener = vi.fn();
    const stop = onPmAttentionChanged(listener);

    await acceptOnboardingSkipRequest("s1");
    await denyOnboardingSkipRequest("s2", "later");
    await markOnboardingFeedbackRead("f1");

    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });

  it("stops telling a listener that unsubscribed", async () => {
    const listener = vi.fn();
    const stop = onPmAttentionChanged(listener);
    stop();

    await acceptOnboardingSkipRequest("s1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("tells every listener", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onPmAttentionChanged(first);
    const stopSecond = onPmAttentionChanged(second);

    await markOnboardingFeedbackRead("f1");

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    stopSecond();
  });

  it("does not tell anybody when the request failed", async () => {
    server.use(http.post("/api/v1/admin/onboarding/skips/:id/accept", fail));
    const listener = vi.fn();
    const stop = onPmAttentionChanged(listener);

    await expect(acceptOnboardingSkipRequest("s1")).rejects.toThrow();

    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it("sends the review comment, empty by default", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post("/api/v1/admin/onboarding/skips/:id/accept", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({});
      }),
      http.post("/api/v1/admin/onboarding/skips/:id/deny", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({});
      }),
    );

    await acceptOnboardingSkipRequest("s1");
    await denyOnboardingSkipRequest("s1", "not now");

    expect(bodies).toEqual([{ reviewComment: "" }, { reviewComment: "not now" }]);
  });
});

describe("onboarding feedback", () => {
  it("takes the message from the comment and reads a definite read flag", async () => {
    server.use(
      http.get("/api/v1/admin/onboarding/feedback", () =>
        HttpResponse.json([
          { id: "a", comment: "from comment" },
          { id: "b", message: "kept", read: true },
          { id: "c", message: "read by date", readAt: "2026-01-01" },
          { id: "d" },
        ]),
      ),
    );

    const feedback = await getAllOnboardingFeedback();

    expect(feedback.map((item) => [item.id, item.message, item.read])).toEqual([
      ["a", "from comment", false],
      ["b", "kept", true],
      ["c", "read by date", true],
      ["d", "", false],
    ]);
  });

  it("reads one user's feedback the same way", async () => {
    server.use(
      http.get("/api/v1/admin/onboarding/users/u1/feedback", () =>
        HttpResponse.json([{ id: "a", comment: "hi" }]),
      ),
    );

    await expect(getUserOnboardingFeedback("u1")).resolves.toEqual([
      { id: "a", comment: "hi", message: "hi", read: false },
    ]);
  });
});

describe("the team overview", () => {
  function member(userId: string) {
    return {
      userId,
      firstname: userId,
      lastname: "",
      roles: [{ roleId: "r1", name: "Dev" }],
      projectIds: [{ projectId: "p1", name: "Alpha" }],
      progressPercentage: 0,
      currentStep: null,
    };
  }

  it("asks with the filters it was given, and leaves out the ones it was not", async () => {
    const urls: string[] = [];
    server.use(
      http.get("/api/v1/onboarding/team-overview", ({ request }) => {
        urls.push(new URL(request.url).search);
        return HttpResponse.json({ content: [member("u1")] });
      }),
      http.get("/api/v1/admin/onboarding/feedback", () => HttpResponse.json([])),
    );

    await getTeamOverview("r1", "HIGHEST_PROGRESS", ["p1", "p2"]);
    await getTeamOverview("all");
    await getTeamOverview();

    expect(urls[0]).toBe(
      "?roleIds=r1&projectIds=p1&projectIds=p2&sortBy=HIGHEST_PROGRESS&size=100",
    );
    expect(urls[1]).toBe("?size=100");
    expect(urls[2]).toBe("?size=100");
  });

  it("normalises the roles and projects of what it reads", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({ content: [member("u1")] }),
      ),
      http.get("/api/v1/admin/onboarding/feedback", () => HttpResponse.json([])),
    );

    const [user] = await getTeamOverview();

    expect(user.roles[0].id).toBe("r1");
    expect(user.projects).toEqual([{ id: "p1", name: "Alpha" }]);
    expect(user.hasFeedback).toBe(false);
  });

  it("flags only members with feedback nobody read", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({ content: [member("u1"), member("u2"), member("u3")] }),
      ),
      http.get("/api/v1/admin/onboarding/feedback", () =>
        HttpResponse.json([
          { id: "1", userId: "u1", message: "x", read: true },
          { id: "2", userId: "u2", message: "x", readAt: "2026-01-01" },
          { id: "3", userId: "u3", message: "x" },
          { id: "4", message: "no user" },
        ]),
      ),
    );

    const users = await getTeamOverview();

    expect(users.map((user) => [user.userId, user.hasFeedback])).toEqual([
      ["u1", false],
      ["u2", false],
      ["u3", true],
    ]);
  });

  it("returns the members without a flag when the feedback cannot be read", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({ content: [member("u1")] }),
      ),
      http.get("/api/v1/admin/onboarding/feedback", fail),
    );

    const users = await getTeamOverview();

    expect(users.map((user) => user.userId)).toEqual(["u1"]);
    expect(users[0].hasFeedback).toBeUndefined();
  });

  it("falls back to the mock members when the overview cannot be read", async () => {
    server.use(http.get("/api/v1/onboarding/team-overview", fail));

    await expect(getTeamOverview()).resolves.toBe(mockUsers);
  });

  it("finds a member, or none", async () => {
    server.use(
      http.get("/api/v1/onboarding/team-overview", () =>
        HttpResponse.json({ content: [member("u1")] }),
      ),
      http.get("/api/v1/admin/onboarding/feedback", () => HttpResponse.json([])),
    );

    await expect(getTeamMember("u1")).resolves.toMatchObject({ userId: "u1" });
    await expect(getTeamMember("nobody")).resolves.toBeUndefined();
  });

  it("reads the own row normalised, and lets a failure through", async () => {
    server.use(
      http.get("/api/v1/onboarding/me/team-overview", () => HttpResponse.json(member("me"))),
    );
    const mine = await getMyTeamOverview();
    expect(mine.roles[0].id).toBe("r1");
    expect(mine.projects).toEqual([{ id: "p1", name: "Alpha" }]);

    server.use(http.get("/api/v1/onboarding/me/team-overview", fail));
    await expect(getMyTeamOverview()).rejects.toThrow();
  });
});

describe("project roles", () => {
  it("reads a wrapped answer, an empty wrapper, and falls back on failure", async () => {
    server.use(
      http.get("/api/v1/projectRoles", () =>
        HttpResponse.json({ projectRoles: [{ id: "r1", name: "Dev", description: "" }] }),
      ),
    );
    await expect(getProjectRoles()).resolves.toEqual([{ id: "r1", name: "Dev", description: "" }]);

    server.use(http.get("/api/v1/projectRoles", () => HttpResponse.json({})));
    await expect(getProjectRoles()).resolves.toEqual([]);

    server.use(http.get("/api/v1/projectRoles", fail));
    await expect(getProjectRoles()).resolves.toBe(mockProjectRoles);
  });

  it("takes a role away from a user", async () => {
    let called = "";
    server.use(
      http.delete("/api/v1/users/:userId/project-roles/:roleId", ({ params }) => {
        called = `${String(params.userId)}/${String(params.roleId)}`;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await unassignProjectRoleFromUser("u1", "r1");

    expect(called).toBe("u1/r1");
  });
});

describe("a member's onboarding path", () => {
  const step = { id: "st1", title: "Step" };

  it("returns a path whose phases carry their steps, with questions filled in", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/u1/path", () =>
        HttpResponse.json({ id: "path", phases: [{ id: "ph1", steps: [step] }] }),
      ),
    );

    await expect(getUserOnboardingPath("u1")).resolves.toEqual({
      id: "path",
      phases: [{ id: "ph1", steps: [step], questions: [] }],
    });
  });

  it("keeps the questions a phase already has", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/u1/path", () =>
        HttpResponse.json({
          id: "path",
          phases: [{ id: "ph1", steps: [step], questions: [{ id: "q" }] }],
        }),
      ),
    );

    const path = await getUserOnboardingPath("u1");

    expect(path?.phases[0].questions).toEqual([{ id: "q" }]);
  });

  it("reads the phases separately when the path came without any", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/u1/path", () =>
        HttpResponse.json({ id: "path", phases: [] }),
      ),
      http.get("/api/v1/onboarding/users/u1/path/phases", () =>
        HttpResponse.json([{ id: "ph1", steps: [step] }]),
      ),
    );

    const path = await getUserOnboardingPath("u1");

    expect(path?.phases.map((phase) => phase.id)).toEqual(["ph1"]);
  });

  it("loads the steps of a phase that came without any", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/u1/path", () =>
        HttpResponse.json({ id: "path", phases: [{ id: "ph1", steps: [] }, { id: "ph2" }] }),
      ),
      http.get("/api/v1/onboarding/phases/:phaseId/steps", ({ params }) =>
        HttpResponse.json([{ id: `step-of-${String(params.phaseId)}` }]),
      ),
    );

    const path = await getUserOnboardingPath("u1");

    expect(path?.phases.map((phase) => phase.steps.map((entry) => entry.id))).toEqual([
      ["step-of-ph1"],
      ["step-of-ph2"],
    ]);
  });

  it("gives a phase an empty step list when its steps cannot be loaded", async () => {
    server.use(
      http.get("/api/v1/onboarding/users/u1/path", () =>
        HttpResponse.json({ id: "path", phases: [{ id: "ph1", steps: [] }] }),
      ),
      http.get("/api/v1/onboarding/phases/:phaseId/steps", fail),
    );

    const path = await getUserOnboardingPath("u1");

    expect(path?.phases[0]).toMatchObject({ id: "ph1", steps: [], questions: [] });
  });

  it("is null when the path cannot be loaded at all", async () => {
    server.use(http.get("/api/v1/onboarding/users/u1/path", fail));

    await expect(getUserOnboardingPath("u1")).resolves.toBeNull();
  });
});

describe("steps and tasks of a member's path", () => {
  it("sends each request to its endpoint with its body", async () => {
    const seen: string[] = [];
    const record =
      (label: string) =>
      async ({ request }: { request: Request }) => {
        const text = await request.text();
        seen.push(`${label} ${text}`);
        return HttpResponse.json({ id: "x" });
      };
    server.use(
      http.post("/api/v1/onboarding/phases/ph1/steps", record("createStep")),
      http.put("/api/v1/onboarding/steps/st1", record("updateStep")),
      http.post("/api/v1/onboarding/steps/st1/tasks", record("createTask")),
      http.put("/api/v1/onboarding/tasks/t1", record("updateTask")),
      http.delete("/api/v1/onboarding/steps/st1", record("deleteStep")),
      http.delete("/api/v1/onboarding/tasks/t1", record("deleteTask")),
    );
    const stepRequest = {
      position: 1,
      title: "Step",
      description: "d",
      type: "DOCUMENT" as const,
      estimatedMinutes: 5,
    };

    await createOnboardingStepForPhase("ph1", stepRequest);
    await updateOnboardingStep("st1", { ...stepRequest, status: "DONE" });
    await createOnboardingTaskForStep("st1", { position: 1, title: "T", description: "d" });
    await updateOnboardingTask("t1", { position: 2, title: "T", description: "d", finished: true });
    await deleteOnboardingStep("st1");
    await deleteOnboardingTask("t1");

    expect(seen).toEqual([
      `createStep ${JSON.stringify(stepRequest)}`,
      `updateStep ${JSON.stringify({ ...stepRequest, status: "DONE" })}`,
      `createTask ${JSON.stringify({ position: 1, title: "T", description: "d" })}`,
      `updateTask ${JSON.stringify({ position: 2, title: "T", description: "d", finished: true })}`,
      "deleteStep ",
      "deleteTask ",
    ]);
  });

  it("lists the tasks of a step, or none when that fails", async () => {
    server.use(
      http.get("/api/v1/onboarding/steps/st1/tasks", () => HttpResponse.json([{ id: "t1" }])),
    );
    await expect(getOnboardingTasksByStep("st1")).resolves.toEqual([{ id: "t1" }]);

    server.use(http.get("/api/v1/onboarding/steps/st1/tasks", fail));
    await expect(getOnboardingTasksByStep("st1")).resolves.toEqual([]);
  });
});

describe("skills", () => {
  it("reads the role of a skill from the older shapes and fills in the defaults", async () => {
    server.use(
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          { id: "a", name: "A", projectRole: { id: "r1" } },
          { id: "b", name: "B", roleId: "r2" },
          { id: "c", name: "C" },
          {
            id: "d",
            name: "D",
            roleIds: ["r3"],
            status: "RETIRED",
            category: "X",
            universal: true,
          },
        ]),
      ),
    );

    const skills = await getSkills();

    expect(skills).toEqual([
      { id: "a", name: "A", roleIds: ["r1"], status: "ACTIVE", category: null, universal: false },
      { id: "b", name: "B", roleIds: ["r2"], status: "ACTIVE", category: null, universal: false },
      { id: "c", name: "C", roleIds: [], status: "ACTIVE", category: null, universal: false },
      { id: "d", name: "D", roleIds: ["r3"], status: "RETIRED", category: "X", universal: true },
    ]);
  });

  it("falls back to the mock skills when the list cannot be read", async () => {
    server.use(http.get("/api/v1/skills", fail));

    await expect(getSkills()).resolves.toBe(mockSkills);
  });
});

describe("the skill assessment", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("remembers whether the prompt was dismissed or completed, per user", () => {
    expect(getSkillAssessmentPromptState("u1")).toBeNull();

    markSkillAssessmentPromptDismissed("u1");
    expect(getSkillAssessmentPromptState("u1")).toBe("dismissed");
    expect(getSkillAssessmentPromptState("u2")).toBeNull();

    markSkillAssessmentPromptCompleted("u1");
    expect(getSkillAssessmentPromptState("u1")).toBe("completed");
  });

  it("ignores a stored value it does not know", () => {
    window.localStorage.setItem("skill-assessment-prompt-state:u1", "something");

    expect(getSkillAssessmentPromptState("u1")).toBeNull();
  });

  it("knows whether the signed-in user assessed anything", async () => {
    server.use(http.get("/api/v1/me/skills", () => HttpResponse.json([{ skillId: "s" }])));
    await expect(hasCompletedSkillAssessment("u1")).resolves.toBe(true);

    server.use(http.get("/api/v1/me/skills", () => HttpResponse.json([])));
    await expect(hasCompletedSkillAssessment("u1")).resolves.toBe(false);
  });

  it("answers from the in-memory assessments, which are empty, when the request fails", async () => {
    server.use(http.get("/api/v1/me/skills", fail));

    await expect(hasCompletedSkillAssessment("u1")).resolves.toBe(false);
  });

  it("labels unknown skills and roles, and joins several roles", async () => {
    server.use(
      http.get("/api/v1/admin/users/u1/skill-assessments/completed", () =>
        HttpResponse.json([
          { userId: "u1", skillId: "known", level: "EXPERT" },
          { userId: "u1", skillId: "ghost", level: "BEGINNER" },
          { userId: "u1", skillId: "orphan", level: "BEGINNER" },
        ]),
      ),
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          { id: "known", name: "TypeScript", roleIds: ["r1", "r2"] },
          { id: "orphan", name: "Cooking", roleIds: ["elsewhere"] },
        ]),
      ),
      http.get("/api/v1/projectRoles", () =>
        HttpResponse.json([
          { id: "r1", name: "Frontend" },
          { id: "r2", name: "Backend" },
        ]),
      ),
    );

    const levels = await getUserSkillLevels("u1");

    expect(levels.map((level) => [level.skillName, level.roleName, level.level])).toEqual([
      ["TypeScript", "Frontend, Backend", "EXPERT"],
      ["Unknown skill", "Unknown role", "BEGINNER"],
      ["Cooking", "Unknown role", "BEGINNER"],
    ]);
  });

  it("is empty when the assessments of another user cannot be read", async () => {
    server.use(http.get("/api/v1/admin/users/u1/skill-assessments/completed", fail));

    await expect(getUserSkillLevels("u1")).resolves.toEqual([]);
  });

  it("is empty when the own levels cannot be read", async () => {
    server.use(http.get("/api/v1/me/skills", fail));

    await expect(getMySkillLevels([])).resolves.toEqual([]);
  });

  it("keys the own levels by the assessment's own user", async () => {
    server.use(
      http.get("/api/v1/me/skills", () =>
        HttpResponse.json([{ userId: "me", skillId: "s", level: "ADVANCED" }]),
      ),
      http.get("/api/v1/skills", () =>
        HttpResponse.json([{ id: "s", name: "Go", roleIds: ["r"] }]),
      ),
    );

    const levels = await getMySkillLevels([{ id: "r", name: "Dev" }]);

    expect(levels).toEqual([
      { id: "me-s", skillId: "s", skillName: "Go", roleName: "Dev", level: "ADVANCED" },
    ]);
  });
});
