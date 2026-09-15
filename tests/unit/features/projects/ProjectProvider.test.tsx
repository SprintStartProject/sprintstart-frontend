import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectProvider } from "../../../../src/features/projects/ProjectProvider";
import { ProjectContext } from "../../../../src/features/projects/ProjectContext";
import { projectService } from "../../../../src/services/projectService";
import type { AdminProject } from "../../../../src/services/projectService";

const BASE_KEY = "sprintstart:selected-project-id";

const { auth } = vi.hoisted(() => ({
  auth: {
    userId: "user-a",
    permissionGroup: "ADMIN",
    status: "authenticated",
  },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    status: auth.status,
    profile: auth.userId ? { id: auth.userId, permissionGroup: auth.permissionGroup } : null,
  }),
}));

vi.mock("../../../../src/services/projectService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/projectService")>();
  return { ...actual, projectService: { ...actual.projectService, getProjects: vi.fn() } };
});

function project(id: string, name: string): AdminProject {
  return {
    id,
    name,
    description: "",
    manager: null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
  };
}

/** Reports the selection the provider settles on — the value every consumer reads. */
function Probe() {
  const context = useContext(ProjectContext);
  return <span data-testid="selection">{context?.selectedProjectId || "none"}</span>;
}

/** Waits for the provider to settle the selection, then reports it. */
async function renderAndReadSelection(): Promise<string> {
  render(
    <ProjectProvider>
      <Probe />
    </ProjectProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("selection")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId("selection")).not.toHaveTextContent("none"));

  return screen.getByTestId("selection").textContent ?? "";
}

describe("ProjectProvider selection storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    auth.userId = "user-a";
    auth.permissionGroup = "ADMIN";
    auth.status = "authenticated";
    vi.clearAllMocks();
    vi.mocked(projectService.getProjects).mockResolvedValue([
      project("p1", "Alpha"),
      project("p2", "Beta"),
    ]);
  });

  it("restores the project this user had selected", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "p2");

    expect(await renderAndReadSelection()).toBe("p2");
  });

  it("does not restore a selection belonging to somebody else", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-b`, "p2");

    // The other user's project is never adopted: this user falls back to their own list.
    expect(await renderAndReadSelection()).toBe("p1");
    expect(window.localStorage.getItem(`${BASE_KEY}:user-b`)).toBe("p2");
  });

  it("drops the unscoped selection an older version of the app left behind", async () => {
    window.localStorage.setItem(BASE_KEY, "previous-persons-project");

    expect(await renderAndReadSelection()).toBe("p1");
    expect(window.localStorage.getItem(BASE_KEY)).toBeNull();
  });

  it("heals a stored project the user can no longer reach, and rewrites the entry", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "deleted-project");

    expect(await renderAndReadSelection()).toBe("p1");
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBe("p1");
  });

  it("clears the stored selection when the user has no projects left", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "p2");
    vi.mocked(projectService.getProjects).mockResolvedValue([]);

    render(
      <ProjectProvider>
        <Probe />
      </ProjectProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("none"));
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBeNull();
  });

  it("still boots to a project when storage refuses to answer", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    const selection = await renderAndReadSelection();
    getItem.mockRestore();

    expect(selection).toBe("p1");
  });
});
