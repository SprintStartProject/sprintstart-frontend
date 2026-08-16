import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { ProjectDetailsDrawer } from "../../../../../src/features/admin/components/ProjectDetailsDrawer";
import type {
  AdminProjectDetails,
  AdminUser,
  ProjectOverview,
} from "../../../../../src/features/admin/types";

vi.mock("../../../../../src/services/projectService", () => ({
  projectService: {
    getProjectById: vi.fn(),
    deleteProject: vi.fn(),
    removeUserFromProject: vi.fn(),
    assignUsersToProject: vi.fn(),
    setProjectManager: vi.fn(),
    clearProjectManager: vi.fn(),
    updateProject: vi.fn(),
  },
}));

import { projectService } from "../../../../../src/services/projectService";

/**
 * Save/delete outcomes are toasts now, so every render is wrapped in a
 * ToastProvider — otherwise `useToast` no-ops and the error/success toasts
 * (e.g. a failed delete) never mount.
 */
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

const projectOverview: ProjectOverview = {
  id: "proj-1",
  name: "Alpha",
  description: "Overview description",
  manager: null,
  sources: [],
  users: [],
};

const projectDetails: AdminProjectDetails = {
  id: "proj-1",
  name: "Alpha",
  description: "Detailed project description",
  manager: null,
  sources: [{ id: "src-1", name: "Repo A", type: "GITHUB", status: "CONNECTED" }],
  users: [
    {
      id: "u-1",
      username: "jane.doe",
      email: "jane@example.com",
      firstName: "Jane",
      lastName: "Doe",
      roles: ["ADMIN"],
      projectRoles: ["MEMBER"],
      enabled: true,
    },
  ],
};

describe("ProjectDetailsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDetails);
  });

  it("renders the drawer title from the project overview", async () => {
    render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => expect(vi.mocked(projectService.getProjectById)).toHaveBeenCalled());
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("shows a loading state while project details are being fetched", () => {
    vi.mocked(projectService.getProjectById).mockReturnValue(
      new Promise<AdminProjectDetails>(() => {}),
    );

    render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Loading project details...")).toBeInTheDocument();
    expect(vi.mocked(projectService.getProjectById)).toHaveBeenCalledWith("proj-1");
  });

  it("loads and displays project details via the service", async () => {
    vi.mocked(projectService.getProjectById).mockResolvedValue(projectDetails);

    render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Detailed project description")).toBeInTheDocument(),
    );
    expect(screen.getByText("Repo A")).toBeInTheDocument();
    // Shares the Data Ingestion source badges, so the raw enum is rendered
    // as its display label alongside the connection status.
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("shows an error state when the project details fail to load", async () => {
    vi.mocked(projectService.getProjectById).mockRejectedValue(new Error("Network down"));

    render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Project details could not be loaded")).toBeInTheDocument(),
    );
    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("does not fetch details while the drawer is closed", () => {
    render(<ProjectDetailsDrawer project={projectOverview} isOpen={false} onClose={vi.fn()} />);

    expect(vi.mocked(projectService.getProjectById)).not.toHaveBeenCalled();
  });

  describe("project deletion", () => {
    it("hides the danger zone from users who cannot manage the lifecycle", async () => {
      render(
        <ProjectDetailsDrawer
          project={projectOverview}
          isOpen={true}
          canManageLifecycle={false}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() =>
        expect(screen.getByText("Detailed project description")).toBeInTheDocument(),
      );
      expect(screen.queryByRole("button", { name: "Delete project" })).not.toBeInTheDocument();
    });

    it("asks for confirmation before deleting and reports the deletion", async () => {
      const user = userEvent.setup();
      const onProjectDeleted = vi.fn();
      const onClose = vi.fn();
      vi.mocked(projectService.deleteProject).mockResolvedValue({
        id: "proj-1",
        deleted: true,
      });

      render(
        <ProjectDetailsDrawer
          project={projectOverview}
          isOpen={true}
          canManageLifecycle
          onClose={onClose}
          onProjectDeleted={onProjectDeleted}
        />,
      );

      await waitFor(() =>
        expect(screen.getByText("Detailed project description")).toBeInTheDocument(),
      );

      await user.click(screen.getByRole("button", { name: "Delete project" }));

      // Nothing is deleted until the dialog is confirmed.
      const dialog = screen.getByRole("alertdialog");
      expect(vi.mocked(projectService.deleteProject)).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "Delete project" }));

      await waitFor(() =>
        expect(vi.mocked(projectService.deleteProject)).toHaveBeenCalledWith("proj-1"),
      );
      expect(onProjectDeleted).toHaveBeenCalledWith("proj-1");
      expect(onClose).toHaveBeenCalled();
    });

    it("keeps the drawer open and shows the error when deletion fails", async () => {
      const user = userEvent.setup();
      const onProjectDeleted = vi.fn();
      vi.mocked(projectService.deleteProject).mockRejectedValue(
        new Error("Project is still referenced"),
      );

      render(
        <ProjectDetailsDrawer
          project={projectOverview}
          isOpen={true}
          canManageLifecycle
          onClose={vi.fn()}
          onProjectDeleted={onProjectDeleted}
        />,
      );

      await waitFor(() =>
        expect(screen.getByText("Detailed project description")).toBeInTheDocument(),
      );

      await user.click(screen.getByRole("button", { name: "Delete project" }));
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Delete project",
        }),
      );

      await waitFor(() =>
        expect(screen.getByText("Project is still referenced")).toBeInTheDocument(),
      );
      expect(onProjectDeleted).not.toHaveBeenCalled();
    });
  });

  describe("unified dirty state", () => {
    it("edits name and description directly, without an edit mode", async () => {
      const user = userEvent.setup();
      render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      // There is no edit mode to enter first.
      expect(screen.queryByRole("button", { name: /Edit Project/i })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Description")).toBeEnabled();

      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Beta");

      expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    });

    it("counts detail and people changes together in one footer", async () => {
      const user = userEvent.setup();
      render(
        <ProjectDetailsDrawer
          project={projectOverview}
          availableUsers={[]}
          isOpen={true}
          onClose={vi.fn()}
        />,
      );

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      await user.type(screen.getByLabelText("Description"), "!");
      await user.click(screen.getByRole("button", { name: /Remove Jane Doe from project/ }));

      expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    });

    it("saves detail and people changes in one action", async () => {
      const user = userEvent.setup();
      vi.mocked(projectService.updateProject).mockResolvedValue(projectDetails);
      vi.mocked(projectService.removeUserFromProject).mockResolvedValue(undefined);

      render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Beta");
      await user.click(screen.getByRole("button", { name: /Remove Jane Doe from project/ }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(vi.mocked(projectService.updateProject)).toHaveBeenCalledWith("proj-1", {
          name: "Beta",
          description: "Detailed project description",
        }),
      );
      expect(vi.mocked(projectService.removeUserFromProject)).toHaveBeenCalledWith("proj-1", "u-1");
    });

    it("rejects an empty name before calling the service", async () => {
      const user = userEvent.setup();
      render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      await user.clear(screen.getByLabelText("Name"));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(screen.getByText("Project name is required.")).toBeInTheDocument();
      expect(vi.mocked(projectService.updateProject)).not.toHaveBeenCalled();
    });

    it("discards detail and people changes together", async () => {
      const user = userEvent.setup();
      render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Beta");
      await user.click(screen.getByRole("button", { name: /Remove Jane Doe from project/ }));
      await user.click(screen.getByRole("button", { name: "Discard" }));

      expect(screen.getByLabelText("Name")).toHaveValue("Alpha");
      expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
    });

    it("shows no footer while nothing is staged", async () => {
      render(<ProjectDetailsDrawer project={projectOverview} isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Alpha"));

      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    });
  });

  describe("people section", () => {
    const availableUsers = [
      {
        id: "u-1",
        username: "jane.doe",
        email: "jane@example.com",
        firstName: "Jane",
        lastName: "Doe",
        permissionGroup: "User",
        projectIds: ["proj-1"],
        projectNames: [],
        projectRoles: [],
        enabled: true,
        profileIcon: null,
      },
      {
        id: "u-2",
        username: "tom.fischer",
        email: "tom@example.com",
        firstName: "Tom",
        lastName: "Fischer",
        permissionGroup: "User",
        projectIds: [],
        projectNames: [],
        projectRoles: [],
        enabled: true,
        profileIcon: null,
      },
    ] as unknown as AdminUser[];

    function renderDrawer(props: Record<string, unknown> = {}) {
      return render(
        <ProjectDetailsDrawer
          project={projectOverview}
          availableUsers={availableUsers}
          isOpen={true}
          canManageLifecycle
          onClose={vi.fn()}
          {...props}
        />,
      );
    }

    it("lists members with their role, manager first", async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        ...projectDetails,
        manager: {
          id: "u-1",
          username: "jane.doe",
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
        },
      });

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
      // The manager is one row in the people list, not a separate entity.
      expect(screen.getByText("Manager")).toBeInTheDocument();
      expect(screen.getByText("1 person · 1 manager")).toBeInTheDocument();
    });

    it("shows a manager who has no membership row", async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        ...projectDetails,
        users: [],
        manager: {
          id: "u-2",
          username: "tom.fischer",
          email: "tom@example.com",
          firstName: "Tom",
          lastName: "Fischer",
        },
      });

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Tom Fischer")).toBeInTheDocument());
      expect(screen.getByText("Manager")).toBeInTheDocument();
    });

    it("stages an added user and saves it with the save bar", async () => {
      const user = userEvent.setup();
      vi.mocked(projectService.assignUsersToProject).mockResolvedValue([]);

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

      await user.type(screen.getByRole("textbox", { name: "Search or add people" }), "tom");
      await user.click(screen.getByRole("button", { name: /Tom Fischer/ }));

      // Staged only — nothing is written until the save bar is used.
      expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
      expect(vi.mocked(projectService.assignUsersToProject)).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(vi.mocked(projectService.assignUsersToProject)).toHaveBeenCalledWith("proj-1", {
          userIds: ["u-2"],
        }),
      );
    });

    it("discards staged changes", async () => {
      const user = userEvent.setup();
      renderDrawer();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /Remove Jane Doe from project/ }));
      expect(screen.getByText("1 unsaved change")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Discard" }));

      expect(screen.queryByText("1 unsaved change")).not.toBeInTheDocument();
      expect(vi.mocked(projectService.removeUserFromProject)).not.toHaveBeenCalled();
    });

    it("promotes a member to manager and saves the assignment", async () => {
      const user = userEvent.setup();
      vi.mocked(projectService.setProjectManager).mockResolvedValue(projectDetails);

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /Make Jane Doe project manager/ }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(vi.mocked(projectService.setProjectManager)).toHaveBeenCalledWith("proj-1", "u-1"),
      );
    });

    it("disables the make-manager control for a member without the PM role", async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        ...projectDetails,
        users: [
          {
            id: "u-3",
            username: "lea.klein",
            email: "lea@example.com",
            firstName: "Lea",
            lastName: "Klein",
            roles: ["USER"],
            projectRoles: ["MEMBER"],
            enabled: true,
          },
        ],
      });

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Lea Klein")).toBeInTheDocument());

      // The backend rejects a non-PM manager, so the UI blocks the promotion
      // up front and explains why instead of surfacing a bare "Bad request".
      expect(
        screen.getByRole("button", {
          name: /Make Lea Klein project manager — requires the Project Manager \(PM\) role/,
        }),
      ).toBeDisabled();
    });

    it("blocks removing the manager until they are demoted", async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({
        ...projectDetails,
        manager: {
          id: "u-1",
          username: "jane.doe",
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
        },
      });

      renderDrawer();

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

      // The backend rejects removing the current manager, so the UI does
      // not let the request be staged in the first place.
      expect(screen.getByRole("button", { name: /Remove Jane Doe from project/ })).toBeDisabled();
    });

    it("hides manager controls from users who cannot assign managers", async () => {
      renderDrawer({ canManageLifecycle: false });

      await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());

      expect(
        screen.queryByRole("button", { name: /Make Jane Doe project manager/ }),
      ).not.toBeInTheDocument();
    });
  });
});
