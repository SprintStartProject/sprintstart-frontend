import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectProvider } from "../../../../src/features/projects/ProjectProvider";
import { ProjectContext } from "../../../../src/features/projects/ProjectContext";
import { projectService, type AdminProject } from "../../../../src/services/projectService";
import { userService } from "../../../../src/services/userService";

const { auth } = vi.hoisted(() => ({
  auth: { userId: "pm-1", permissionGroup: "PM", status: "authenticated" },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    status: auth.status,
    profile: auth.userId ? { id: auth.userId, permissionGroup: auth.permissionGroup } : null,
  }),
}));

vi.mock("../../../../src/services/projectService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: { ...actual.projectService, getProjects: vi.fn(), getManagedProjects: vi.fn() },
  };
});

vi.mock("../../../../src/services/userService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/userService")>();
  return { ...actual, userService: { ...actual.userService, getMyProjects: vi.fn() } };
});

function adminProject(id: string, name: string, managerId: string | null): AdminProject {
  return {
    id,
    name,
    description: "",
    manager: managerId ? ({ id: managerId } as AdminProject["manager"]) : null,
    sources: [{} as AdminProject["sources"][number]],
    users: [{} as AdminProject["users"][number], {} as AdminProject["users"][number]],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
  };
}

const managed = (id: string, name: string) =>
  ({
    id,
    name,
    description: "",
    industry: "",
    industryConfidence: null,
    industryCustom: false,
    memberCount: 4,
  }) as never;
const membership = (id: string, name: string) => ({ id, name }) as never;

/** Publishes what the context says, as text a test can read. */
function Probe() {
  const context = useContext(ProjectContext);
  if (!context || context.isLoading) return <span data-testid="state">loading</span>;
  const projects = context.projects.map((p) => `${p.name}:${p.isManaged ? "managed" : "member"}`);
  return (
    <span data-testid="state">
      {JSON.stringify({
        projects,
        selected: context.selectedProjectId || null,
        has: context.hasSelectedProject,
        canManage: context.canManageSelected,
        switcher: context.isSwitcherEnabled,
        error: context.errorMessage,
      })}
    </span>
  );
}

async function settledState(): Promise<Record<string, unknown>> {
  render(
    <ProjectProvider>
      <Probe />
    </ProjectProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("state")).not.toHaveTextContent("loading"));
  return JSON.parse(screen.getByTestId("state").textContent ?? "{}") as Record<string, unknown>;
}

describe("ProjectProvider project sources", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    auth.userId = "pm-1";
    auth.permissionGroup = "PM";
    auth.status = "authenticated";
  });

  it("lists a manager's own projects first, then the ones they only joined, each group by name", async () => {
    vi.mocked(projectService.getManagedProjects).mockResolvedValue([
      managed("m2", "Zeta"),
      managed("m1", "Alpha"),
    ]);
    vi.mocked(userService.getMyProjects).mockResolvedValue([
      membership("m1", "Alpha"),
      membership("j2", "Omega"),
      membership("j1", "Beta"),
    ]);

    const state = await settledState();

    expect(state.projects).toEqual([
      "Alpha:managed",
      "Zeta:managed",
      "Beta:member",
      "Omega:member",
    ]);
    expect(state).toMatchObject({
      selected: "m1",
      has: true,
      canManage: true,
      switcher: true,
      error: null,
    });
  });

  it("still shows a manager's memberships when the managed lookup fails", async () => {
    vi.mocked(projectService.getManagedProjects).mockRejectedValue(new Error("403"));
    vi.mocked(userService.getMyProjects).mockResolvedValue([membership("j1", "Beta")]);

    const state = await settledState();

    expect(state).toMatchObject({ projects: ["Beta:member"], canManage: false, error: null });
  });

  it("gives a hire their memberships without the project switcher", async () => {
    auth.userId = "hire-1";
    auth.permissionGroup = "USER";
    vi.mocked(userService.getMyProjects).mockResolvedValue([membership("j1", "Beta")]);

    const state = await settledState();

    expect(state).toMatchObject({
      projects: ["Beta:member"],
      selected: "j1",
      canManage: false,
      switcher: false,
    });
    expect(projectService.getProjects).not.toHaveBeenCalled();
    expect(projectService.getManagedProjects).not.toHaveBeenCalled();
  });

  it("marks only the projects an admin is the assigned manager of as theirs", async () => {
    auth.userId = "admin-1";
    auth.permissionGroup = "ADMIN";
    vi.mocked(projectService.getProjects).mockResolvedValue([
      adminProject("a", "Alpha", "someone-else"),
      adminProject("b", "Beta", "admin-1"),
      adminProject("c", "Gamma", null),
    ]);

    const state = await settledState();

    expect(state.projects).toEqual(["Beta:managed", "Alpha:member", "Gamma:member"]);
    expect(state).toMatchObject({ selected: "b", canManage: true });
  });

  it("loads every project for HR the way it does for an admin", async () => {
    auth.userId = "hr-1";
    auth.permissionGroup = "HR";
    vi.mocked(projectService.getProjects).mockResolvedValue([adminProject("a", "Alpha", null)]);

    const state = await settledState();

    expect(state).toMatchObject({ projects: ["Alpha:member"], switcher: true });
    expect(userService.getMyProjects).not.toHaveBeenCalled();
  });

  it("reports a failed load and selects nothing", async () => {
    auth.permissionGroup = "ADMIN";
    vi.mocked(projectService.getProjects).mockRejectedValue(new Error("Backend unavailable"));

    const state = await settledState();

    expect(state).toMatchObject({
      projects: [],
      selected: null,
      has: false,
      error: "Backend unavailable",
    });
  });

  it("says nothing is selected when the user is on no project", async () => {
    vi.mocked(projectService.getManagedProjects).mockResolvedValue([]);
    vi.mocked(userService.getMyProjects).mockResolvedValue([]);

    const state = await settledState();

    expect(state).toMatchObject({ projects: [], selected: null, has: false, canManage: false });
  });
});
