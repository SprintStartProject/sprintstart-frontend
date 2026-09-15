import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { projectService } from "../../../src/services/projectService";
import { server } from "../../unit/setup/vitest.setup";

const backendProject = {
  id: "project-1",
  name: "SprintStart Frontend",
  description: null,
  industry: "Fintech",
  industryConfidence: "high",
  sources: [
    {
      id: "source-1",
      name: "Frontend Repo",
      type: "GITHUB",
      status: "CONNECTED",
    },
  ],
  users: [
    {
      id: "user-1",
      username: "max.mustermann",
      email: null,
    },
  ],
};

const backendProjectDetails = {
  ...backendProject,
  users: [
    {
      id: "user-1",
      username: "max.mustermann",
      email: null,
      firstName: "Max",
      lastName: "Mustermann",
      roles: ["USER"],
      projectRoles: ["MANAGER"],
      enabled: true,
    },
  ],
};

describe("projectService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProjects maps backend project summaries", async () => {
    server.use(http.get("/api/v1/admin/projects", () => HttpResponse.json([backendProject])));

    const projects = await projectService.getProjects();

    expect(projects).toEqual([
      {
        id: "project-1",
        name: "SprintStart Frontend",
        description: "",
        manager: null,
        sources: [
          {
            id: "source-1",
            name: "Frontend Repo",
            type: "GITHUB",
            status: "CONNECTED",
          },
        ],
        users: [
          {
            id: "user-1",
            username: "max.mustermann",
            email: "",
            projectRoles: [],
          },
        ],
        industry: "Fintech",
        industryConfidence: "high",
        industryCustom: false,
      },
    ]);
  });

  it("getProjects normalizes a missing or unknown industry confidence to null", async () => {
    server.use(
      http.get("/api/v1/admin/projects", () =>
        HttpResponse.json([
          { ...backendProject, industry: null, industryConfidence: null },
          { ...backendProject, id: "project-2", industryConfidence: "unexpected" },
        ]),
      ),
    );

    const projects = await projectService.getProjects();

    expect(projects[0].industry).toBe("");
    expect(projects[0].industryConfidence).toBeNull();
    expect(projects[1].industryConfidence).toBeNull();
  });

  it("falls back to current-user project ids when admin projects are forbidden", async () => {
    server.use(
      http.get("/api/v1/admin/projects", () => new HttpResponse("Forbidden", { status: 403 })),
      http.get("/api/v1/users/me", () => HttpResponse.json({ projectIds: ["12345678-abcd"] })),
    );

    const projects = await projectService.getProjects();

    expect(projects).toEqual([
      {
        id: "12345678-abcd",
        name: "Project 12345678",
        description: "",
        manager: null,
        sources: [],
        users: [],
        industry: "",
        industryConfidence: null,
        industryCustom: false,
      },
    ]);
  });

  it("getProjectById returns detailed project users", async () => {
    server.use(
      http.get("/api/v1/admin/projects/project-1", () => HttpResponse.json(backendProjectDetails)),
    );

    const details = await projectService.getProjectById("project-1");

    expect(details.users[0]).toMatchObject({
      id: "user-1",
      email: "",
      firstName: "Max",
      projectRoles: ["MANAGER"],
    });
  });

  it("createProject posts only backend-supported fields", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/admin/projects", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          ...backendProjectDetails,
          id: "project-new",
          name: "Test Project",
          description: "Test Desc",
          sources: [],
          users: [],
        });
      }),
    );

    const newProject = await projectService.createProject({
      name: "Test Project",
      description: "Test Desc",
    });

    expect(capturedBody).toEqual({
      name: "Test Project",
      description: "Test Desc",
    });
    expect(newProject.id).toBe("project-new");
  });

  it("createProject sends industry when provided", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/admin/projects", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...backendProjectDetails, id: "project-new" });
      }),
    );

    await projectService.createProject({
      name: "Test Project",
      industry: "Fintech",
    });

    expect(capturedBody).toEqual({
      name: "Test Project",
      industry: "Fintech",
    });
  });

  it("updateProject patches backend-supported fields and keeps empty descriptions", async () => {
    let capturedBody: unknown;
    server.use(
      http.patch("/api/v1/admin/projects/project-1", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          ...backendProjectDetails,
          name: "Renamed Project",
          description: "",
        });
      }),
    );

    const updatedProject = await projectService.updateProject("project-1", {
      name: "Renamed Project",
      description: "",
    });

    expect(capturedBody).toEqual({
      name: "Renamed Project",
      description: "",
    });
    expect(updatedProject.name).toBe("Renamed Project");
    expect(updatedProject.description).toBe("");
  });

  it("assignUsersToProject returns backend response without a follow-up fetch", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/v1/admin/projects/project-1/users", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(backendProjectDetails.users);
      }),
    );

    const users = await projectService.assignUsersToProject("project-1", {
      userIds: ["user-1"],
    });

    expect(capturedBody).toEqual({ userIds: ["user-1"] });
    expect(users[0].projectRoles).toEqual(["MANAGER"]);
  });

  it("deleteProject returns the backend deletion response", async () => {
    server.use(
      http.delete("/api/v1/admin/projects/project-1", () =>
        HttpResponse.json({ id: "project-1", deleted: true }),
      ),
    );

    const result = await projectService.deleteProject("project-1");

    expect(result).toEqual({ id: "project-1", deleted: true });
  });

  it("evaluateProjectIndustry returns the AI evaluation", async () => {
    server.use(
      http.post("/api/v1/projects/project-1/industry/evaluate", () =>
        HttpResponse.json({
          industry: "Fintech",
          confidence: "medium",
          evidence: ["Mentions payment processing", "References banking APIs"],
        }),
      ),
    );

    const evaluation = await projectService.evaluateProjectIndustry("project-1");

    expect(evaluation).toEqual({
      industry: "Fintech",
      confidence: "medium",
      evidence: ["Mentions payment processing", "References banking APIs"],
    });
  });

  it("evaluateProjectIndustry propagates a 502 when the AI service fails", async () => {
    server.use(
      http.post(
        "/api/v1/projects/project-1/industry/evaluate",
        () => new HttpResponse("Bad Gateway", { status: 502 }),
      ),
    );

    await expect(projectService.evaluateProjectIndustry("project-1")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("setProjectIndustry puts the industry and returns the custom result", async () => {
    let capturedBody: unknown;
    server.use(
      http.put("/api/v1/projects/project-1/industry", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          industry: "Healthcare",
          industryConfidence: null,
          industryCustom: true,
        });
      }),
    );

    const result = await projectService.setProjectIndustry("project-1", "Healthcare");

    expect(capturedBody).toEqual({ industry: "Healthcare" });
    expect(result).toEqual({
      industry: "Healthcare",
      industryConfidence: null,
      industryCustom: true,
    });
  });

  it("setProjectIndustry propagates a 403 when the caller may not manage the project", async () => {
    server.use(
      http.put(
        "/api/v1/projects/project-1/industry",
        () => new HttpResponse("Forbidden", { status: 403 }),
      ),
    );

    await expect(
      projectService.setProjectIndustry("project-1", "Healthcare"),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});
