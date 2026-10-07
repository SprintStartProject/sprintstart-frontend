import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTeamOverview,
  getTeamOverviewOrThrow,
  getTeamMember,
  getPmAttentionCount,
  getProjectRoles,
  createProjectRole,
  acceptSkillSuggestion,
  assignProjectRoleToUser,
  createSkill,
  deleteSkill,
  getSkills,
  getSkillById,
  updateSkill,
  getSkillsByRoleId,
  updateRoleSkills,
  suggestSkillsForRole,
  reactivateSkill,
  getMySkillLevels,
  getUserSkillLevels,
  saveUserSkillAssessments,
  deleteProjectRole,
} from "../../../src/services/teamManagementService";
import { apiClient } from "../../../src/services/apiClient";
import { http, HttpResponse } from "msw";
import { server } from "../../unit/setup/vitest.setup";

describe("teamManagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTeamOverview returns team users from API", async () => {
    const overview = await getTeamOverview();
    expect(overview.length).toBeGreaterThan(0);
    expect(overview[0].firstname).toBe("Alice");
  });

  it("getTeamMember finds a user by ID", async () => {
    const member = await getTeamMember("user1");
    expect(member).not.toBeNull();
    expect(member?.userId).toBe("user1");
  });

  describe("getPmAttentionCount", () => {
    const member = (userId: string, skipStatus?: "PENDING" | "ACCEPTED") => ({
      userId,
      firstname: userId,
      lastname: "",
      roles: [],
      progressPercentage: 0,
      currentStep: skipStatus
        ? {
            id: `step-${userId}`,
            title: "Step",
            skip: { id: `skip-${userId}`, status: skipStatus },
          }
        : null,
    });

    it("adds pending skip requests and the project's unread feedback", async () => {
      let requestedProject: string | null = null;
      server.use(
        http.get("/api/v1/onboarding/team-overview", ({ request }) => {
          requestedProject = new URL(request.url).searchParams.get("projectIds");
          return HttpResponse.json({
            content: [member("u1", "PENDING"), member("u2", "ACCEPTED"), member("u3")],
          });
        }),
        http.get("/api/v1/admin/onboarding/feedback", () =>
          HttpResponse.json([
            { id: "f1", userId: "u2", message: "unclear", read: false },
            { id: "f2", userId: "u3", message: "thanks", readAt: null },
            { id: "f3", userId: "u3", message: "seen", read: true },
            // Somebody from another project: the feedback list is not scoped by project.
            { id: "f4", userId: "elsewhere", message: "hi", read: false },
          ]),
        ),
      );

      await expect(getPmAttentionCount("proj1")).resolves.toEqual({
        pendingSkips: 1,
        unreadFeedback: 2,
        total: 3,
      });
      expect(requestedProject).toBe("proj1");
    });

    it("fails instead of counting mock members when the overview is unavailable", async () => {
      server.use(
        http.get("/api/v1/onboarding/team-overview", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/v1/admin/onboarding/feedback", () => HttpResponse.json([])),
      );

      await expect(getPmAttentionCount("proj1")).rejects.toThrow();
    });

    it("fails instead of leaving feedback out when the feedback list is unavailable", async () => {
      server.use(
        http.get("/api/v1/onboarding/team-overview", () =>
          HttpResponse.json({ content: [member("u1", "PENDING")] }),
        ),
        http.get(
          "/api/v1/admin/onboarding/feedback",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      await expect(getPmAttentionCount("proj1")).rejects.toThrow();
    });
  });

  describe("getTeamOverviewOrThrow", () => {
    const member = (userId: string) => ({
      userId,
      firstname: userId,
      lastname: "",
      roles: [],
      progressPercentage: 0,
      currentStep: null,
    });

    it("flags the members with unread feedback, like getTeamOverview", async () => {
      server.use(
        http.get("/api/v1/onboarding/team-overview", () =>
          HttpResponse.json({ content: [member("u1"), member("u2")] }),
        ),
        http.get("/api/v1/admin/onboarding/feedback", () =>
          HttpResponse.json([{ id: "f1", userId: "u2", message: "unclear", read: false }]),
        ),
      );

      const overview = await getTeamOverviewOrThrow(["proj1"]);
      expect(overview.map((user) => [user.userId, user.hasFeedback])).toEqual([
        ["u1", false],
        ["u2", true],
      ]);
    });

    it("fails instead of returning mock members when the overview is unavailable", async () => {
      server.use(
        http.get("/api/v1/onboarding/team-overview", () => new HttpResponse(null, { status: 500 })),
        http.get("/api/v1/admin/onboarding/feedback", () => HttpResponse.json([])),
      );

      await expect(getTeamOverviewOrThrow(["proj1"])).rejects.toThrow();
      // The forgiving variant still falls back, for the screens that only list the team.
      await expect(getTeamOverview(undefined, undefined, ["proj1"])).resolves.not.toHaveLength(0);
    });

    it("fails instead of reading 'nothing unread' when the feedback list is unavailable", async () => {
      server.use(
        http.get("/api/v1/onboarding/team-overview", () =>
          HttpResponse.json({ content: [member("u1")] }),
        ),
        http.get(
          "/api/v1/admin/onboarding/feedback",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      await expect(getTeamOverviewOrThrow(["proj1"])).rejects.toThrow();
    });
  });

  it("getProjectRoles returns project roles", async () => {
    server.use(
      http.get("/api/v1/projectRoles", () =>
        HttpResponse.json([{ id: "role1", name: "Developer" }]),
      ),
    );

    const roles = await getProjectRoles();
    expect(roles).toHaveLength(1);
    expect(roles[0].name).toBe("Developer");
  });

  it("createProjectRole posts to backend and returns the new role", async () => {
    server.use(
      http.post("/api/v1/projectRoles", async ({ request }) => {
        const body = (await request.json()) as { name: string; description: string };
        return HttpResponse.json({
          id: "new-role-1",
          name: body.name,
          description: body.description,
        });
      }),
    );

    const newRole = await createProjectRole("Tester", "QA");
    expect(newRole.name).toBe("Tester");
    expect(newRole.id).toBe("new-role-1");
  });

  it("createProjectRole sends only the role fields supported by the backend", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/projectRoles", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: "role-1",
          name: "Developer",
          description: "Builds features",
        });
      }),
    );

    await createProjectRole("Developer", "Builds features");

    expect(capturedBody).toEqual({
      name: "Developer",
      description: "Builds features",
    });
  });

  it("suggestSkillsForRole posts project context and reads the response wrapper", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/projectRoles/role1/skills/suggest", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          suggestions: [
            {
              skillId: "skill-ai-1",
              name: "Prompt Engineering",
              category: "AI",
              reason: "Useful for the role",
              confidence: "high",
              isNew: false,
              chunkIds: ["chunk-1"],
            },
          ],
        });
      }),
    );

    const suggestions = await suggestSkillsForRole("role1", {
      projectId: "project-1",
      industry: "Fintech",
    });

    expect(capturedBody).toEqual({ projectId: "project-1", industry: "Fintech" });
    expect(suggestions).toEqual([
      {
        skillId: "skill-ai-1",
        name: "Prompt Engineering",
        category: "AI",
        reason: "Useful for the role",
        confidence: "high",
        isNew: false,
        chunkIds: ["chunk-1"],
      },
    ]);
  });

  it("acceptSkillSuggestion posts the reviewed item and maps the updated role skills", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/projectRoles/role1/skills/suggestions/accept", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json([
          {
            id: "skill-ai-1",
            name: "Prompt Engineering",
            roleIds: ["role1"],
            status: "ACTIVE",
            category: "AI",
            universal: false,
          },
        ]);
      }),
    );

    const skills = await acceptSkillSuggestion("role1", {
      name: "Prompt Engineering",
      category: "AI",
    });

    expect(capturedBody).toEqual({ name: "Prompt Engineering", category: "AI" });
    expect(skills[0]).toEqual({
      id: "skill-ai-1",
      name: "Prompt Engineering",
      roleIds: ["role1"],
      status: "ACTIVE",
      category: "AI",
      universal: false,
    });
  });
  it("suggestSkillsForRole propagates backend failures without a mock fallback", async () => {
    server.use(
      http.post("/api/v1/projectRoles/role1/skills/suggest", () =>
        HttpResponse.json({ message: "AI unavailable" }, { status: 502 }),
      ),
    );

    await expect(suggestSkillsForRole("role1")).rejects.toMatchObject({
      status: 502,
      message: "AI unavailable",
    });
  });
  it("assignProjectRoleToUser sends request to backend", async () => {
    let captured = false;
    server.use(
      http.post("/api/v1/users/user1/project-roles", () => {
        captured = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await assignProjectRoleToUser("user1", "role1");
    expect(captured).toBe(true);
  });

  it("getSkills maps multi-role skills and status from API", async () => {
    server.use(
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          {
            id: "skill1",
            name: "TypeScript",
            roleIds: ["role1", "role2"],
            status: "ACTIVE",
            category: "ENGINEERING",
            universal: true,
          },
          {
            id: "skill2",
            name: "Legacy API",
            roleIds: [],
            status: "RETIRED",
          },
        ]),
      ),
    );

    const skills = await getSkills();

    expect(skills).toEqual([
      {
        id: "skill1",
        name: "TypeScript",
        roleIds: ["role1", "role2"],
        status: "ACTIVE",
        category: "ENGINEERING",
        universal: true,
      },
      {
        id: "skill2",
        name: "Legacy API",
        roleIds: [],
        status: "RETIRED",
        category: null,
        universal: false,
      },
    ]);
  });

  it("createSkill posts the request to the admin skill endpoint", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/admin/skills", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: "skill1",
          name: "React",
          roleIds: ["role1"],
          status: "ACTIVE",
        });
      }),
    );

    const skill = await createSkill({ name: "React", roleIds: ["role1"] });

    expect(capturedBody).toEqual({
      name: "React",
      roleIds: ["role1"],
    });
    expect(skill.roleIds).toEqual(["role1"]);
    expect(skill.status).toBe("ACTIVE");
  });

  it("createSkill propagates a duplicate-name conflict without a mock fallback", async () => {
    server.use(
      http.post("/api/v1/admin/skills", () =>
        HttpResponse.json({ message: "Skill already exists" }, { status: 409 }),
      ),
    );

    await expect(createSkill({ name: "React", roleIds: ["role1"] })).rejects.toMatchObject({
      status: 409,
      message: "Skill already exists",
    });
  });

  it("reactivateSkill reactivates a retired skill through the admin endpoint", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/admin/skills", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: "skill1",
          name: "React",
          roleIds: ["role1"],
          status: "ACTIVE",
        });
      }),
    );

    const skill = await reactivateSkill("skill1", "React", ["role1"]);

    expect(capturedBody).toEqual({
      name: "React",
      roleIds: ["role1"],
    });
    expect(skill.status).toBe("ACTIVE");
    expect(skill.id).toBe("skill1");
  });

  it("reactivateSkill propagates backend failures without a mock fallback", async () => {
    server.use(
      http.post("/api/v1/admin/skills", () =>
        HttpResponse.json({ message: "Not allowed" }, { status: 403 }),
      ),
    );

    await expect(reactivateSkill("skill1", "React", ["role1"])).rejects.toMatchObject({
      status: 403,
      message: "Not allowed",
    });
  });

  it("getSkillById fetches a single skill", async () => {
    server.use(
      http.get("/api/v1/skills/skill1", () =>
        HttpResponse.json({
          id: "skill1",
          name: "TypeScript",
          roleIds: ["role1"],
          status: "ACTIVE",
        }),
      ),
    );

    const skill = await getSkillById("skill1");

    expect(skill.id).toBe("skill1");
    expect(skill.name).toBe("TypeScript");
    expect(skill.roleIds).toEqual(["role1"]);
    expect(skill.status).toBe("ACTIVE");
  });

  it("updateSkill patches a skill through the admin endpoint, category included", async () => {
    let capturedBody: unknown;
    server.use(
      http.patch("/api/v1/admin/skills/skill1", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: "skill1",
          name: "React",
          roleIds: ["role1", "role2"],
          status: "ACTIVE",
          category: "ENGINEERING",
        });
      }),
    );

    const skill = await updateSkill("skill1", {
      name: "React",
      roleIds: ["role1", "role2"],
      category: "ENGINEERING",
    });

    expect(capturedBody).toEqual({
      name: "React",
      roleIds: ["role1", "role2"],
      category: "ENGINEERING",
    });
    expect(skill.roleIds).toEqual(["role1", "role2"]);
    expect(skill.name).toBe("React");
    expect(skill.category).toBe("ENGINEERING");
  });

  it("updateSkill propagates a duplicate-name conflict without a mock fallback", async () => {
    server.use(
      http.patch("/api/v1/admin/skills/skill1", () =>
        HttpResponse.json({ message: "Skill already exists" }, { status: 409 }),
      ),
    );

    await expect(updateSkill("skill1", { name: "React", category: null })).rejects.toMatchObject({
      status: 409,
      message: "Skill already exists",
    });
  });

  it("getSkillsByRoleId fetches skills linked to a role", async () => {
    server.use(
      http.get("/api/v1/projectRoles/role1/skills", () =>
        HttpResponse.json([
          {
            id: "skill1",
            name: "TypeScript",
            roleIds: ["role1"],
            status: "ACTIVE",
            category: "ENGINEERING",
            universal: true,
          },
        ]),
      ),
    );

    const skills = await getSkillsByRoleId("role1");

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("TypeScript");
    expect(skills[0].roleIds).toEqual(["role1"]);
  });

  it("updateRoleSkills replaces skills linked to a role", async () => {
    let capturedBody: unknown;
    server.use(
      http.put("/api/v1/projectRoles/role1/skills", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json([
          {
            id: "skill1",
            name: "TypeScript",
            roleIds: ["role1"],
            status: "ACTIVE",
            category: "ENGINEERING",
            universal: true,
          },
        ]);
      }),
    );

    const skills = await updateRoleSkills("role1", ["skill1"]);

    expect(capturedBody).toEqual({ skillIds: ["skill1"] });
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe("skill1");
  });

  it("deleteSkill retires skills through the admin endpoint", async () => {
    let captured = false;
    server.use(
      http.delete("/api/v1/admin/skills/skill1", () => {
        captured = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteSkill("skill1");

    expect(captured).toBe(true);
  });

  it("deleteSkill propagates backend failures without a mock fallback", async () => {
    server.use(
      http.delete("/api/v1/admin/skills/skill1", () =>
        HttpResponse.json({ message: "Not allowed" }, { status: 403 }),
      ),
    );

    await expect(deleteSkill("skill1")).rejects.toMatchObject({
      status: 403,
      message: "Not allowed",
    });
  });

  it("saveUserSkillAssessments posts to current-user assessment endpoint", async () => {
    const capturedSkillIds: string[] = [];
    server.use(
      http.post("/api/v1/me/skill/assess", async ({ request }) => {
        const body = (await request.json()) as { skillId: string };
        capturedSkillIds.push(body.skillId);
        return HttpResponse.json({
          id: `assessment-${body.skillId}`,
          userId: "user1",
          skillId: body.skillId,
          level: "ADVANCED",
        });
      }),
    );

    await saveUserSkillAssessments([{ userId: "user1", skillId: "skill1", level: "ADVANCED" }]);

    expect(capturedSkillIds).toEqual(["skill1"]);
  });

  it("getUserSkillLevels reads cross-user assessments from admin endpoint", async () => {
    server.use(
      http.get("/api/v1/admin/users/user1/skill-assessments/completed", () =>
        HttpResponse.json([
          {
            id: "assessment1",
            userId: "user1",
            skillId: "skill1",
            level: "INTERMEDIATE",
          },
        ]),
      ),
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          {
            id: "skill1",
            name: "TypeScript",
            roleIds: ["role1", "role2"],
            status: "ACTIVE",
            category: "ENGINEERING",
            universal: true,
          },
        ]),
      ),
      http.get("/api/v1/projectRoles", () =>
        HttpResponse.json([
          { id: "role1", name: "Frontend" },
          { id: "role2", name: "Backend" },
        ]),
      ),
    );

    const levels = await getUserSkillLevels("user1");

    expect(levels).toEqual([
      {
        id: "user1-skill1",
        skillId: "skill1",
        skillName: "TypeScript",
        roleName: "Frontend, Backend",
        level: "INTERMEDIATE",
      },
    ]);
  });

  it("getMySkillLevels labels the skills from the roles it is handed", async () => {
    server.use(
      http.get("/api/v1/me/skills", () =>
        HttpResponse.json([
          { id: "assessment1", userId: "user1", skillId: "skill1", level: "ADVANCED" },
        ]),
      ),
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          { id: "skill1", name: "TypeScript", roleIds: ["role1"], status: "ACTIVE" },
        ]),
      ),
    );

    const levels = await getMySkillLevels([{ id: "role1", name: "Frontend" }]);

    expect(levels).toEqual([
      {
        id: "user1-skill1",
        skillId: "skill1",
        skillName: "TypeScript",
        roleName: "Frontend",
        level: "ADVANCED",
      },
    ]);
  });

  it("getMySkillLevels labels a skill mapped to a role the user does not hold as unknown", async () => {
    server.use(
      http.get("/api/v1/me/skills", () =>
        HttpResponse.json([
          { id: "assessment1", userId: "user1", skillId: "skill1", level: "ADVANCED" },
        ]),
      ),
      http.get("/api/v1/skills", () =>
        HttpResponse.json([
          { id: "skill1", name: "TypeScript", roleIds: ["role9"], status: "ACTIVE" },
        ]),
      ),
    );

    const levels = await getMySkillLevels([{ id: "role1", name: "Frontend" }]);

    expect(levels[0].roleName).toBe("Unknown role");
  });

  it("getMySkillLevels never calls the admin-only project roles endpoint", async () => {
    // The default MSW handler for `/api/v1/projectRoles` answers 200, so a passing test
    // could still be making the request. Watch the client instead.
    const fetchSpy = vi.spyOn(apiClient, "fetch");

    await getMySkillLevels([{ id: "role1", name: "Frontend" }]);

    const requestedUrls = fetchSpy.mock.calls.map(([url]) => String(url));
    fetchSpy.mockRestore();

    expect(requestedUrls).not.toHaveLength(0);
    expect(requestedUrls.some((url) => url.includes("/projectRoles"))).toBe(false);
  });
});

describe("deleteProjectRole", () => {
  // It used to answer a failed delete by removing the role from the mock data, so the caller
  // reported "Role deleted" while the backend still had it.
  it("lets a failed delete reach the caller", async () => {
    server.use(
      http.delete("/api/v1/projectRoles/:roleId", () => HttpResponse.json({}, { status: 500 })),
    );

    await expect(deleteProjectRole("r1")).rejects.toThrow();
  });

  it("resolves once the backend has deleted the role", async () => {
    server.use(
      http.delete("/api/v1/projectRoles/:roleId", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(deleteProjectRole("r1")).resolves.toBeUndefined();
  });
});
