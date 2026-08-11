import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsDrawer } from "../../../../src/features/admin/components/ProjectDetailsDrawer";
import type { ProjectOverview } from "../../../../src/features/admin/types";

const projectServiceMock = vi.hoisted(() => ({
  getProjectById: vi.fn(),
}));

vi.mock("../../../../src/services/projectService", () => ({
  projectService: {
    getProjectById: projectServiceMock.getProjectById,
  },
}));

const projectOverview: ProjectOverview = {
  id: "project-1",
  name: "SprintStart",
  description: "Overview description",
  manager: null,
  sources: [{ id: "source-1", name: "Repo", type: "GITHUB", status: "CONNECTED" }],
  users: [
    {
      id: "user-1",
      username: "john.doe",
      email: "john@example.com",
      projectRoles: ["MEMBER"],
    },
  ],
};

describe("ProjectDetailsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders project details when opened", async () => {
    projectServiceMock.getProjectById.mockResolvedValue({
      ...projectOverview,
      description: "Detailed description",
      users: [
        {
          id: "user-1",
          username: "john.doe",
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
          roles: ["USER"],
          projectRoles: ["MEMBER"],
          enabled: true,
        },
      ],
    });

    render(<ProjectDetailsDrawer project={projectOverview} isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Loading project details...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Detailed description")).toBeInTheDocument();
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
    });
    expect(projectServiceMock.getProjectById).toHaveBeenCalledWith("project-1");
  });

  it("shows an error message when project details fail to load", async () => {
    projectServiceMock.getProjectById.mockRejectedValue(new Error("Project unavailable"));

    render(<ProjectDetailsDrawer project={projectOverview} isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Project details could not be loaded")).toBeInTheDocument();
      expect(screen.getByText("Project unavailable")).toBeInTheDocument();
    });
  });
});
