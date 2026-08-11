import { http, HttpResponse, delay } from "msw";

const encoder = new TextEncoder();

function sseStream(...events: string[]) {
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        await delay(5);
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });
}

export const backendUser = {
  id: "1",
  authId: "auth-1",
  username: "testuser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: ["project-1"],
  permissionGroup: "USER" as const,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: true,
};

export const mockProfile = {
  id: "1",
  authId: "auth-1",
  username: "testuser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: ["project-1"],
  permissionGroup: "USER" as const,
  enabled: true,
  profileIcon: null as string | null,
  hasCompletedOnboarding: true,
};

export const handlers = [
  http.get("/api/v1/users/me", () => HttpResponse.json(backendUser)),

  http.patch("/api/v1/users/me", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...backendUser, ...(body as object) });
  }),

  http.get("/api/v1/admin/users", () =>
    HttpResponse.json([
      { ...backendUser, id: "1", username: "user1" },
      { ...backendUser, id: "2", username: "user2" },
    ]),
  ),

  http.get("/api/v1/admin/users/:userId", ({ params }) =>
    HttpResponse.json({ ...backendUser, id: params.userId }),
  ),

  http.patch("/api/v1/admin/users/:userId", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...backendUser,
      id: params.userId,
      ...body,
    });
  }),

  http.delete("/api/v1/admin/users/:userId", () => HttpResponse.json({ id: "123", deleted: true })),

  http.get("/api/v1/admin/projects", () =>
    HttpResponse.json([
      {
        id: "project-1",
        name: "SprintStart Project",
        description: "Default test project",
        sources: [
          {
            id: "source-1",
            name: "SprintStart Repository",
            type: "GITHUB",
            status: "CONNECTED",
          },
        ],
        users: [],
      },
    ]),
  ),

  http.get("/api/v1/users/me/projects", () =>
    HttpResponse.json([{ id: "project-1", name: "SprintStart Project" }]),
  ),

  // A single managed project by default, which is what most pages assume. Tests
  // that care about managing several projects override this handler.
  http.get("/api/v1/projects/managed", () =>
    HttpResponse.json([
      {
        id: "project-1",
        name: "SprintStart Project",
        description: "Default test project",
        memberCount: 2,
      },
    ]),
  ),

  // No connected sources by default; tests that care override this handler.
  http.get("/api/v1/ingestion-sources/status", () => HttpResponse.json([])),

  http.get("/api/v1/projects/:projectId/artifacts", () =>
    HttpResponse.json({
      items: [],
      page: {
        number: 1,
        size: 100,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    }),
  ),
  http.get("/api/v1/chats", () =>
    HttpResponse.json({
      chats: [
        {
          id: "chat1",
          userId: "user1",
          title: "Chat 1",
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  ),

  http.get("/api/v1/chats/me", () =>
    HttpResponse.json({
      chats: [
        {
          id: "chat1",
          userId: "user1",
          title: "Chat 1",
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  ),

  http.post("/api/v1/chats", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    return HttpResponse.json({
      id: "new-chat-id",
      userId: body.userId ?? "user1",
      title: "",
      createdAt: new Date().toISOString(),
    });
  }),

  http.post("/api/v1/chats/me", () => {
    return HttpResponse.json({
      id: "new-chat-id",
      userId: "user1",
      title: "",
      createdAt: new Date().toISOString(),
    });
  }),

  http.patch("/api/v1/admin/users/:userId/enabled", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      ...backendUser,
      id: params.userId,
      ...body,
    });
  }),

  http.get("/api/v1/chats/:chatId", ({ params }) =>
    HttpResponse.json({
      messages: [
        {
          id: "msg1",
          content: "Hello",
          role: "USER",
          chat: null,
          chatId: params.chatId,
        },
      ],
    }),
  ),

  http.get("/api/v1/chats/me/:chatId", ({ params }) =>
    HttpResponse.json({
      messages: [
        {
          id: "msg1",
          content: "Hello",
          role: "USER",
          chat: null,
          chatId: params.chatId,
        },
      ],
    }),
  ),

  http.post(
    "/api/v1/chats/prompt",
    () =>
      new HttpResponse(
        sseStream(
          JSON.stringify({ type: "token", content: "Hello " }),
          JSON.stringify({ type: "token", content: "world" }),
          JSON.stringify({ type: "done" }),
        ),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  ),

  http.post(
    "/api/v1/chats/me/prompt",
    () =>
      new HttpResponse(
        sseStream(
          JSON.stringify({ type: "token", content: "Hello " }),
          JSON.stringify({ type: "token", content: "world" }),
          JSON.stringify({ type: "done" }),
        ),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  ),

  http.get("/api/v1/onboarding/me/path", () =>
    HttpResponse.json({
      id: "path1",
      userId: "user1",
      createdAt: new Date().toISOString(),
      phases: [
        {
          id: "phase1",
          pathId: "path1",
          position: 1,
          title: "Phase 1",
          description: "First phase",
          steps: [
            {
              id: "step1",
              phaseId: "phase1",
              position: 1,
              title: "Step 1",
              description: "Do step 1",
              type: "TASK",
              estimatedMinutes: 10,
              expectedOutcomes: [],
              tasks: [],
              resources: [],
              status: "FINISHED",
              startedAt: null,
              completedAt: null,
              feedback: null,
              skip: null,
            },
            {
              id: "step2",
              phaseId: "phase1",
              position: 2,
              title: "Step 2",
              description: "Do step 2",
              type: "TASK",
              estimatedMinutes: 10,
              expectedOutcomes: [],
              tasks: [],
              resources: [],
              status: "IN_PROGRESS",
              startedAt: null,
              completedAt: null,
              feedback: null,
              skip: null,
            },
          ],
        },
      ],
    }),
  ),

  http.post(
    "/api/v1/onboarding/me/path/personalize",
    () =>
      new HttpResponse(
        sseStream(
          JSON.stringify({
            type: "stage",
            name: "Analyzing",
            detail: "Checking skills",
          }),
          JSON.stringify({
            type: "path",
            path: {
              id: "newPath",
              userId: "user1",
              createdAt: new Date().toISOString(),
              phases: [
                {
                  id: "phase1",
                  pathId: "newPath",
                  position: 1,
                  title: "Phase 1",
                  description: "",
                  steps: [
                    {
                      id: "s1",
                      phaseId: "phase1",
                      position: 1,
                      title: "Step 1",
                      description: "",
                      type: "TASK",
                      estimatedMinutes: 10,
                      expectedOutcomes: [],
                      tasks: [],
                      resources: [],
                      status: "OPEN",
                      startedAt: null,
                      completedAt: null,
                      feedback: null,
                      skip: null,
                    },
                  ],
                },
              ],
            },
          }),
          JSON.stringify({ type: "done" }),
        ),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
  ),

  http.put(
    "/api/v1/onboarding/me/steps/:stepId/start",
    () => new HttpResponse(null, { status: 200 }),
  ),

  http.post("/api/v1/onboarding/me/steps/:stepId/skips", () =>
    HttpResponse.json({
      id: "skip1",
      stepId: "step1",
      status: "PENDING",
      reason: "Too hard",
      reviewComment: null,
      createdAt: new Date().toISOString(),
    }),
  ),

  http.put("/api/v1/onboarding/me/tasks/:taskId", () => new HttpResponse(null, { status: 200 })),

  http.get("/api/v1/onboarding/me/team-overview", () =>
    HttpResponse.json({
      userId: "user1",
      firstname: "Alice",
      lastname: "Smith",
      email: "alice@example.com",
      roles: [{ id: "role1", name: "Backend" }],
      skills: [],
      progressPercentage: 0.4,
      currentPhase: { id: "phase1", title: "Phase 1" },
      currentStep: {
        id: "step1",
        title: "Set up your environment",
        startedAt: "2023-01-01T10:00:00Z",
        skip: null,
      },
      hasFeedback: false,
      // Mirrors the API: a list under `projectIds`, keyed by `projectId`.
      projectIds: [{ projectId: "project-1", name: "SprintStart Project", description: null }],
    }),
  ),

  http.get("/api/v1/onboarding/team-overview", ({ request }) => {
    const url = new URL(request.url);
    const roleId = url.searchParams.get("roleIds");
    const users = [
      {
        userId: "user1",
        firstname: "Alice",
        lastname: "Smith",
        email: "alice@example.com",
        roles: [{ id: "role1", name: "Backend" }],
        progressPercentage: 80,
        currentStep: { startedAt: "2023-01-01T10:00:00Z" },
        skills: [],
        projectIds: [{ projectId: "project-1", name: "SprintStart Project", description: null }],
      },
      {
        userId: "user2",
        firstname: "Bob",
        lastname: "Jones",
        email: "bob@example.com",
        roles: [{ id: "role2", name: "Frontend" }],
        progressPercentage: 20,
        currentStep: { startedAt: "2023-01-02T10:00:00Z" },
        skills: [],
        projectIds: [{ projectId: "project-1", name: "SprintStart Project", description: null }],
      },
    ];
    const filtered = roleId ? users.filter((u) => u.roles.some((r) => r.id === roleId)) : users;
    return HttpResponse.json({ content: filtered });
  }),

  http.get("/api/v1/projectRoles", () =>
    HttpResponse.json([
      { id: "role1", name: "Backend" },
      { id: "role2", name: "Frontend" },
    ]),
  ),

  http.get("/api/v1/skills", () =>
    HttpResponse.json([
      {
        id: "skill1",
        name: "TypeScript",
        roleIds: ["role1"],
        status: "ACTIVE",
      },
    ]),
  ),

  http.post("/api/v1/admin/skills", async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      roleIds: string[];
    };
    return HttpResponse.json({
      id: "mock-skill-" + Date.now(),
      name: body.name,
      roleIds: body.roleIds,
      status: "ACTIVE",
    });
  }),

  http.get("/api/v1/skills/:skillId", ({ params }) =>
    HttpResponse.json({
      id: params.skillId,
      name: "TypeScript",
      roleIds: ["role1"],
      status: "ACTIVE",
    }),
  ),

  http.patch("/api/v1/admin/skills/:skillId", async ({ request, params }) => {
    const body = (await request.json()) as {
      name?: string;
      roleIds?: string[];
    };
    return HttpResponse.json({
      id: params.skillId,
      name: body.name ?? "TypeScript",
      roleIds: body.roleIds ?? ["role1"],
      status: "ACTIVE",
    });
  }),

  http.get("/api/v1/projectRoles/:roleId/skills", ({ params }) =>
    HttpResponse.json([
      {
        id: "skill1",
        name: "TypeScript",
        roleIds: [params.roleId],
        status: "ACTIVE",
      },
    ]),
  ),

  http.put("/api/v1/projectRoles/:roleId/skills", async ({ request, params }) => {
    const body = (await request.json()) as { skillIds: string[] };
    return HttpResponse.json(
      body.skillIds.map((skillId) => ({
        id: skillId,
        name: "Skill " + skillId,
        roleIds: [params.roleId],
        status: "ACTIVE" as const,
      })),
    );
  }),

  http.delete("/api/v1/admin/skills/:skillId", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/v1/me/skills", () => HttpResponse.json([])),

  http.post("/api/v1/me/skill/assess", async ({ request }) => {
    const body = (await request.json()) as { skillId: string; level: string };
    return HttpResponse.json({
      id: "assessment-" + body.skillId,
      userId: "user1",
      skillId: body.skillId,
      level: body.level,
    });
  }),

  http.get("/api/v1/admin/users/:userId/skill-assessments/completed", () => HttpResponse.json([])),

  http.post("/api/v1/projectRoles", async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      description: string;
    };
    return HttpResponse.json({
      id: "mock-role-" + Date.now(),
      name: body.name,
      description: body.description,
    });
  }),

  http.post("/api/v1/users/:userId/project-roles", () => new HttpResponse(null, { status: 200 })),
];
