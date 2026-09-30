import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsDrawer } from "../../../../src/features/admin/components/ProjectDetailsDrawer";
import type { AdminUser, ProjectOverview } from "../../../../src/features/admin/types";

const projectServiceMock = vi.hoisted(() => ({
  getProjectById: vi.fn(),
  assignUsersToProject: vi.fn(),
}));

vi.mock("../../../../src/services/projectService", () => ({
  projectService: {
    getProjectById: projectServiceMock.getProjectById,
    assignUsersToProject: projectServiceMock.assignUsersToProject,
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
  industry: "",
  industryConfidence: null,
  industryCustom: false,
};

function buildAdminUser(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: "user-2",
    username: "jane.smith",
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Smith",
    roles: [],
    permissionGroup: "User",
    projects: [{ id: "project-other", name: "Other Project" }],
    projectIds: ["project-other"],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: false,
    ...overrides,
  };
}

describe("ProjectDetailsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("staging a person from another project", () => {
    async function stageJane(
      availableUser: AdminUser,
      onMembershipsMoved = vi.fn(),
      onClose = vi.fn(),
    ) {
      projectServiceMock.getProjectById.mockResolvedValue({
        ...projectOverview,
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
      projectServiceMock.assignUsersToProject.mockResolvedValue([]);
      const user = userEvent.setup();

      render(
        <ProjectDetailsDrawer
          project={projectOverview}
          availableUsers={[availableUser]}
          isOpen
          onClose={onClose}
          onMembershipsMoved={onMembershipsMoved}
        />,
      );

      // The search field can be re-created while the details settle, which drops
      // typed text, so type until the value sticks.
      await screen.findByText("John Doe");
      await waitFor(async () => {
        const search = screen.getByLabelText("Search or add people");
        await user.clear(search);
        await user.type(search, "jane");
        expect(search).toHaveValue("jane");
      });
      await user.click(await screen.findByText("Jane Smith"));

      return { user, onMembershipsMoved };
    }

    it("marks the staged row and asks before saving a move", async () => {
      const { user, onMembershipsMoved } = await stageJane(buildAdminUser({}));

      expect(screen.getByText("Will be moved from Other Project")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Jane Smith");
      expect(screen.getByRole("alertdialog")).toHaveTextContent("from Other Project");
      expect(projectServiceMock.assignUsersToProject).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Move and save" }));

      await waitFor(() => {
        expect(projectServiceMock.assignUsersToProject).toHaveBeenCalledWith("project-1", {
          userIds: ["user-2"],
        });
        expect(onMembershipsMoved).toHaveBeenCalledTimes(1);
      });
    });

    it("saves nothing when the move dialog is cancelled", async () => {
      const { user, onMembershipsMoved } = await stageJane(buildAdminUser({}));

      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(projectServiceMock.assignUsersToProject).not.toHaveBeenCalled();
      expect(onMembershipsMoved).not.toHaveBeenCalled();
    });

    it("closes only the move dialog on Escape and keeps the drawer open", async () => {
      const onClose = vi.fn();
      const { user } = await stageJane(buildAdminUser({}), vi.fn(), onClose);

      await user.click(screen.getByRole("button", { name: "Save changes" }));
      const dialog = await screen.findByRole("alertdialog");
      // Escape goes to whatever holds focus, and the dialog pulls focus in on the next
      // animation frame, so wait for that before pressing it.
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(projectServiceMock.assignUsersToProject).not.toHaveBeenCalled();
    });

    it("neither marks nor warns for a project manager", async () => {
      const { user, onMembershipsMoved } = await stageJane(
        buildAdminUser({ permissionGroup: "Project Manager" }),
      );

      expect(screen.queryByText(/Will be moved from/)).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(projectServiceMock.assignUsersToProject).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(onMembershipsMoved).not.toHaveBeenCalled();
    });
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
