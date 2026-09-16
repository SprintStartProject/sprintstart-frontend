import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext, useEffect } from "react";
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

  it("publishes nothing until the loaded list confirms the selection it restores", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "p2");

    let releaseProjects: ((projects: AdminProject[]) => void) | undefined;
    vi.mocked(projectService.getProjects).mockReturnValue(
      new Promise<AdminProject[]>((resolve) => {
        releaseProjects = resolve;
      }),
    );

    render(
      <ProjectProvider>
        <Probe />
      </ProjectProvider>,
    );

    // The stored ID is on disk, but no loaded list has vouched for it yet: it must not reach a
    // consumer, which is what used to send requests out for a project this user cannot reach.
    await waitFor(() => expect(projectService.getProjects).toHaveBeenCalled());
    expect(screen.getByTestId("selection")).toHaveTextContent("none");

    await act(async () => {
      releaseProjects?.([project("p1", "Alpha"), project("p2", "Beta")]);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p2"));
  });

  it("drops the selection when the session goes away", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "p2");

    const view = render(
      <ProjectProvider>
        <Probe />
      </ProjectProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p2"));

    auth.userId = "";
    auth.permissionGroup = "";
    auth.status = "unauthenticated";

    await act(async () => {
      view.rerender(
        <ProjectProvider>
          <Probe />
        </ProjectProvider>,
      );
      await Promise.resolve();
    });

    // The selection belongs to a user, so it does not outlive the session that held it.
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("none"));
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

describe("ProjectProvider imperative selection", () => {
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

  /** Names a project the way the `?projectId=` deep link does: on mount, unprompted. */
  function RequestProbe({ projectId }: { projectId: string }) {
    const context = useContext(ProjectContext);
    useEffect(() => {
      context?.setSelectedProjectId(projectId);
      // The context's identity changes once the list loads; re-requesting then is harmless —
      // an unconfirmable id parks again, a confirmable one publishes again unchanged.
    }, [projectId, context]);
    return <span data-testid="selection">{context?.selectedProjectId || "none"}</span>;
  }

  it("publishes a deep link the booting list can confirm, but not before it loads", async () => {
    let releaseProjects: ((projects: AdminProject[]) => void) | undefined;
    vi.mocked(projectService.getProjects).mockReturnValue(
      new Promise<AdminProject[]>((resolve) => {
        releaseProjects = resolve;
      }),
    );

    render(
      <ProjectProvider>
        <RequestProbe projectId="p2" />
      </ProjectProvider>,
    );

    // The request is parked, not published: until a loaded list vouches for it, no consumer
    // may see it — which is what used to fire requests for a project nobody had confirmed.
    await waitFor(() => expect(projectService.getProjects).toHaveBeenCalled());
    expect(screen.getByTestId("selection")).toHaveTextContent("none");

    await act(async () => {
      releaseProjects?.([project("p1", "Alpha"), project("p2", "Beta")]);
      await Promise.resolve();
    });

    // Confirmed by the list that has since loaded: published and persisted like any other pick.
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p2"));
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBe("p2");
  });

  it("never publishes a deep link the loaded list cannot confirm", async () => {
    window.localStorage.setItem(`${BASE_KEY}:user-a`, "p2");

    render(
      <ProjectProvider>
        <RequestProbe projectId="foreign-project" />
      </ProjectProvider>,
    );

    // The unreachable request changes nothing: the stored selection this list confirms stands.
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p2"));
    // Nothing was persisted for the unreachable request: the stored selection stands.
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBe("p2");
  });

  it("keeps the current selection when handed an id the loaded list does not contain", async () => {
    const view = render(
      <ProjectProvider>
        <RequestProbe projectId="p1" />
      </ProjectProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p1"));

    // A later request for a project this user cannot reach: no switch, no persistence.
    await act(async () => {
      view.rerender(
        <ProjectProvider>
          <RequestProbe projectId="unreachable-project" />
        </ProjectProvider>,
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId("selection")).toHaveTextContent("p1"));
    expect(window.localStorage.getItem(`${BASE_KEY}:user-a`)).toBe("p1");
  });
});
