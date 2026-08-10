import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectProvider } from "../../../../src/features/projects/ProjectProvider";
import { ProjectSwitcher } from "../../../../src/features/projects/components/ProjectSwitcher";
import { projectService } from "../../../../src/services/projectService";
import type { AdminProject } from "../../../../src/services/projectService";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "admin-1", username: "admin", permissionGroup: "ADMIN" },
    status: "authenticated",
    logout: vi.fn(),
  }),
}));

vi.mock("../../../../src/services/projectService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/projectService")>();
  return { ...actual, projectService: { ...actual.projectService, getProjects: vi.fn() } };
});

function project(id: string, name: string): AdminProject {
  return { id, name, description: "", manager: null, sources: [], users: [] };
}

describe("ProjectSwitcher end to end with the real provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(projectService.getProjects).mockResolvedValue([
      project("p1", "Alpha"),
      project("p2", "Beta"),
    ]);
  });

  it("switches the selected project when a different card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <ProjectSwitcher />
      </ProjectProvider>,
    );

    // First project is auto-selected once loaded.
    const trigger = await screen.findByRole("button", {
      name: /Current project: Alpha/,
    });

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Switch project" });
    await user.click(within(dialog).getByRole("option", { name: /Beta/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Current project: Beta/ })).toBeInTheDocument();
    });
  });

  it("reopens with the newly selected project checkmarked (3 projects)", async () => {
    vi.mocked(projectService.getProjects).mockResolvedValue([
      project("p1", "Alpha"),
      project("p2", "Beta"),
      project("p3", "Gamma"),
    ]);

    const user = userEvent.setup();
    render(
      <ProjectProvider>
        <ProjectSwitcher />
      </ProjectProvider>,
    );

    const trigger = await screen.findByRole("button", {
      name: /Current project: Alpha/,
    });

    await user.click(trigger);
    await user.click(within(screen.getByRole("dialog")).getByRole("option", { name: /Gamma/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Current project: Gamma/ })).toBeInTheDocument(),
    );

    // Reopen: the clicked project must be the selected option now.
    await user.click(screen.getByRole("button", { name: /Current project: Gamma/ }));
    expect(
      within(screen.getByRole("dialog")).getByRole("option", { name: /Gamma/ }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
