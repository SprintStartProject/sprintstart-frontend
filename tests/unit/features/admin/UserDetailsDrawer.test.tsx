import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { UserDetailsDrawer } from "../../../../src/features/admin/components/UserDetailsDrawer";
import type { AdminUser, ProjectOverview } from "../../../../src/features/admin/types";
import { server } from "../../setup/vitest.setup";

const userDetails: AdminUser = {
  id: "123",
  authId: "auth-123",
  username: "john.doe",
  email: "john@example.com",
  firstName: "John",
  lastName: "Doe",
  roles: [{ id: "role-dev", name: "Developer", description: "", type: "primary" }],
  permissionGroup: "User",
  projects: [],
  projectIds: [],
  enabled: true,
  profileIcon: "",
  hasCompletedOnboarding: true,
};

const projectA = { id: "proj-a", name: "Alpha" };
const projectB = { id: "proj-b", name: "Beta" };

function overview(
  summary: { id: string; name: string },
  managerId?: string,
  overrides: Partial<ProjectOverview> = {},
): ProjectOverview {
  return {
    ...summary,
    description: `${summary.name} description`,
    manager: managerId
      ? { id: managerId, username: "boss", email: "", firstName: "Bea", lastName: "Boss" }
      : null,
    sources: [],
    users: [],
    industry: "",
    industryConfidence: null,
    industryCustom: false,
    ...overrides,
  };
}

function renderDrawer(
  overrides: Partial<AdminUser> = {},
  projects: ProjectOverview[] = [overview(projectA), overview(projectB)],
) {
  const onUserUpdated = vi.fn();
  const onMembershipsMoved = vi.fn();
  const onClose = vi.fn();
  const onOpenProjectDetails = vi.fn();
  const onRequestDelete = vi.fn();

  const { unmount } = render(
    <UserDetailsDrawer
      user={{ ...userDetails, ...overrides }}
      projects={projects}
      isOpen
      onClose={onClose}
      onOpenProjectDetails={onOpenProjectDetails}
      onUserUpdated={onUserUpdated}
      onRequestDelete={onRequestDelete}
      onMembershipsMoved={onMembershipsMoved}
    />,
  );

  return {
    onUserUpdated,
    onClose,
    onOpenProjectDetails,
    onRequestDelete,
    onMembershipsMoved,
    unmount,
  };
}

describe("UserDetailsDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves edited user details and account access changes", async () => {
    const appPatchBodies: unknown[] = [];
    const enabledPatchBodies: unknown[] = [];
    const { onUserUpdated } = renderDrawer();
    const user = userEvent.setup();

    server.use(
      http.patch("/api/v1/admin/users/123", async ({ request }) => {
        const body = await request.json();
        appPatchBodies.push(body);
        return HttpResponse.json({
          id: "123",
          authId: "auth-123",
          username: "john.doe",
          email: "john.new@example.com",
          firstName: "John",
          lastName: "Doe",
          projectRoles: [{ id: "role-dev", name: "Developer" }],
          permissionGroup: "USER",
          enabled: true,
          profileIcon: null,
          hasCompletedOnboarding: true,
        });
      }),
      http.patch("/api/v1/admin/users/123/enabled", async ({ request }) => {
        const body = await request.json();
        enabledPatchBodies.push(body);
        return HttpResponse.json({
          id: "123",
          authId: "auth-123",
          username: "john.doe",
          email: "john.new@example.com",
          firstName: "John",
          lastName: "Doe",
          projectRoles: [{ id: "role-dev", name: "Developer" }],
          permissionGroup: "USER",
          enabled: false,
          profileIcon: null,
          hasCompletedOnboarding: true,
        });
      }),
    );

    await user.click(screen.getByRole("button", { name: "Edit User" }));
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "john.new@example.com");
    await user.click(screen.getByRole("switch", { name: "Toggle account access" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(appPatchBodies).toEqual([
        {
          email: "john.new@example.com",
          firstName: "John",
          lastName: "Doe",
          permissionGroup: "USER",
        },
      ]);
      expect(enabledPatchBodies).toEqual([{ enabled: false }]);
      expect(onUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john.new@example.com",
          enabled: false,
        }),
      );
    });
  });

  it("shows validation feedback when email is empty", async () => {
    const { onUserUpdated } = renderDrawer();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Edit User" }));
    await user.clear(screen.getByLabelText("Email"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(onUserUpdated).not.toHaveBeenCalled();
  });

  describe("coming from another drawer", () => {
    it("offers a way back when it was opened from a project", async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();
      render(
        <UserDetailsDrawer
          user={userDetails}
          projects={[]}
          isOpen
          onClose={vi.fn()}
          onOpenProjectDetails={vi.fn()}
          onUserUpdated={vi.fn()}
          onRequestDelete={vi.fn()}
          back={{ label: "Back to Alpha", onBack }}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Back to Alpha" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("has no back button otherwise", () => {
      renderDrawer();

      expect(screen.queryByRole("button", { name: /^Back to/ })).not.toBeInTheDocument();
    });
  });

  describe("a regular user", () => {
    it("sees exactly one project with a way to move it", () => {
      renderDrawer({ projects: [projectA], projectIds: ["proj-a"] });

      expect(screen.getByText(/Users belong to exactly one project/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Open Alpha project details" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Move to another project/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Add project/ })).not.toBeInTheDocument();
    });

    it("shows the project's manager, size and description on its card", () => {
      renderDrawer({ projects: [projectA], projectIds: ["proj-a"] }, [
        overview(projectA, "boss-1", {
          users: [{ id: "x", username: "x", email: "", projectRoles: [] }],
          industry: "Fintech",
        }),
        overview(projectB),
      ]);

      expect(screen.getByText("Alpha description")).toBeInTheDocument();
      expect(screen.getByText("Bea Boss")).toBeInTheDocument();
      expect(screen.getByText("1 member")).toBeInTheDocument();
      expect(screen.getByText("0 sources")).toBeInTheDocument();
      expect(screen.getByText("Fintech")).toBeInTheDocument();
    });

    it("says so when the project has no manager", () => {
      renderDrawer({ projects: [projectA], projectIds: ["proj-a"] });

      expect(screen.getByText("No manager")).toBeInTheDocument();
    });

    it("offers to assign a project when the user has none", () => {
      renderDrawer();

      expect(screen.getByText("Not assigned to a project")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Assign project" })).toBeInTheDocument();
    });

    it("opens the project from its card", async () => {
      const { onOpenProjectDetails } = renderDrawer({
        projects: [projectA],
        projectIds: ["proj-a"],
      });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Open Alpha project details" }));

      expect(onOpenProjectDetails).toHaveBeenCalledWith("proj-a");
    });

    it("asks before unassigning and resets nothing until confirmed", async () => {
      const removeRequests: string[] = [];
      server.use(
        http.delete("/api/v1/admin/projects/proj-a/users/123", () => {
          removeRequests.push("proj-a");
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { onUserUpdated } = renderDrawer({ projects: [projectA], projectIds: ["proj-a"] });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Remove Alpha" }));

      expect(await screen.findByRole("alertdialog")).toHaveTextContent(
        "John Doe will no longer be in any project. Project roles and onboarding progress will be reset.",
      );
      expect(removeRequests).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Unassign" }));

      await waitFor(() => {
        expect(onUserUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [], projectIds: [] }),
        );
      });
      expect(removeRequests).toEqual(["proj-a"]);
    });

    it("keeps the project when the unassign is cancelled", async () => {
      const { onUserUpdated } = renderDrawer({ projects: [projectA], projectIds: ["proj-a"] });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Remove Alpha" }));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(onUserUpdated).not.toHaveBeenCalled();
    });

    it("flags a user who is in several projects and lets the extras go", () => {
      renderDrawer({
        projects: [projectA, projectB],
        projectIds: ["proj-a", "proj-b"],
      });

      expect(
        screen.getByText(/Users may only be in one project\. John Doe is in 2 projects/),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Alpha" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove Beta" })).toBeInTheDocument();
    });
  });

  describe("a project manager or admin", () => {
    const manager = {
      permissionGroup: "Project Manager",
      projects: [projectA, projectB],
      projectIds: ["proj-a", "proj-b"],
    };

    it("sees what they manage apart from what they are a member of", () => {
      renderDrawer(manager, [overview(projectA, "123"), overview(projectB, "boss-1")]);

      expect(screen.getByText(/Manages 1 · Member of 1/)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Projects managed" })).toHaveTextContent("Alpha");
      expect(screen.getByRole("region", { name: "Projects joined as member" })).toHaveTextContent(
        "Beta",
      );
      expect(screen.queryByText(/Users belong to exactly one project/)).not.toBeInTheDocument();
    });

    it("cannot remove a project they manage until they are replaced as manager", () => {
      renderDrawer(manager, [overview(projectA, "123"), overview(projectB, "boss-1")]);

      expect(
        screen.getByRole("button", { name: "Remove Alpha — remove as manager first" }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Remove Beta" })).toBeEnabled();
    });

    it("lists a managed project even when the user is not on its member list", () => {
      renderDrawer({ ...manager, projects: [projectB], projectIds: ["proj-b"] }, [
        overview(projectA, "123"),
        overview(projectB),
      ]);

      expect(screen.getByText(/Manages 1 · Member of 1/)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Projects managed" })).toHaveTextContent("Alpha");
    });

    it("removes a non-last project straight away", async () => {
      server.use(
        http.delete("/api/v1/admin/projects/proj-b/users/123", () => {
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const { onUserUpdated } = renderDrawer(manager, [
        overview(projectA, "123"),
        overview(projectB),
      ]);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Remove Beta" }));

      await waitFor(() => {
        expect(onUserUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [projectA], projectIds: ["proj-a"] }),
        );
      });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("confirms before removing their last project", async () => {
      const { onUserUpdated } = renderDrawer({
        ...manager,
        projects: [projectB],
        projectIds: ["proj-b"],
      });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Remove Beta" }));

      expect(await screen.findByRole("alertdialog")).toHaveTextContent(
        "will no longer be in any project",
      );
      expect(onUserUpdated).not.toHaveBeenCalled();
    });

    it("tells admins they can reach every project, and nobody else", () => {
      const { unmount } = renderDrawer({ ...manager, permissionGroup: "Admin" });
      expect(screen.getByText(/Admins can access every project/)).toBeInTheDocument();
      unmount();

      renderDrawer(manager);
      expect(screen.queryByText(/Admins can access every project/)).not.toBeInTheDocument();
    });
  });

  describe("changing a role", () => {
    async function chooseRole(user: ReturnType<typeof userEvent.setup>, role: string) {
      await user.click(screen.getByRole("button", { name: "Role" }));
      await user.click(screen.getByRole("option", { name: role }));
    }

    it("warns when a project manager would be left in several projects", async () => {
      renderDrawer({
        permissionGroup: "Project Manager",
        projects: [projectA, projectB],
        projectIds: ["proj-a", "proj-b"],
      });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit User" }));
      expect(
        screen.queryByText(/This role change leaves conflicts behind/),
      ).not.toBeInTheDocument();

      await chooseRole(user, "User");

      expect(screen.getByText(/This role change leaves conflicts behind/)).toBeInTheDocument();
      expect(screen.getByText(/John Doe is in 2 projects/)).toBeInTheDocument();
    });

    it("warns when a manager would lose the role the assignment needs", async () => {
      renderDrawer(
        { permissionGroup: "Project Manager", projects: [projectA], projectIds: ["proj-a"] },
        [overview(projectA, "123"), overview(projectB)],
      );
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit User" }));
      await chooseRole(user, "User");

      expect(screen.getByText(/John Doe manages Alpha/)).toBeInTheDocument();
    });

    it("drops the warning again when the change is reverted", async () => {
      renderDrawer({
        permissionGroup: "Project Manager",
        projects: [projectA, projectB],
        projectIds: ["proj-a", "proj-b"],
      });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit User" }));
      await chooseRole(user, "User");
      await chooseRole(user, "Admin");

      expect(
        screen.queryByText(/This role change leaves conflicts behind/),
      ).not.toBeInTheDocument();
    });

    it("stays quiet when nothing is left behind", async () => {
      renderDrawer({
        permissionGroup: "Project Manager",
        projects: [projectA],
        projectIds: ["proj-a"],
      });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Edit User" }));
      await chooseRole(user, "User");

      expect(
        screen.queryByText(/This role change leaves conflicts behind/),
      ).not.toBeInTheDocument();
    });
  });

  describe("assigning a project", () => {
    async function pickProjectB(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        screen.getByRole("button", { name: /Add project|Move to another project|Assign project/i }),
      );
      await user.click(screen.getByText("Beta"));
    }

    it("warns before moving a regular user and replaces the project list", async () => {
      const assignRequests: string[] = [];
      server.use(
        http.post("/api/v1/admin/projects/proj-b/users", () => {
          assignRequests.push("proj-b");
          return HttpResponse.json([]);
        }),
      );
      const { onUserUpdated, onMembershipsMoved } = renderDrawer({
        projects: [projectA],
        projectIds: ["proj-a"],
      });
      const user = userEvent.setup();

      await pickProjectB(user);

      expect(await screen.findByRole("alertdialog")).toHaveTextContent(
        "John Doe will be removed from Alpha.",
      );
      expect(assignRequests).toEqual([]);

      await user.click(screen.getByRole("button", { name: "Move user" }));

      await waitFor(() => {
        expect(onUserUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [projectB], projectIds: ["proj-b"] }),
        );
      });
      expect(assignRequests).toEqual(["proj-b"]);
      expect(onMembershipsMoved).toHaveBeenCalledTimes(1);
    });

    it("does not assign anything when the move is cancelled", async () => {
      const assignRequests: string[] = [];
      server.use(
        http.post("/api/v1/admin/projects/proj-b/users", () => {
          assignRequests.push("proj-b");
          return HttpResponse.json([]);
        }),
      );
      const { onUserUpdated, onMembershipsMoved } = renderDrawer({
        projects: [projectA],
        projectIds: ["proj-a"],
      });
      const user = userEvent.setup();

      await pickProjectB(user);
      await user.click(await screen.findByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
      expect(assignRequests).toEqual([]);
      expect(onUserUpdated).not.toHaveBeenCalled();
      expect(onMembershipsMoved).not.toHaveBeenCalled();
    });

    it("adds the project without a dialog for a project manager", async () => {
      server.use(http.post("/api/v1/admin/projects/proj-b/users", () => HttpResponse.json([])));
      const { onUserUpdated, onMembershipsMoved } = renderDrawer({
        permissionGroup: "Project Manager",
        projects: [projectA],
        projectIds: ["proj-a"],
      });
      const user = userEvent.setup();

      await pickProjectB(user);

      await waitFor(() => {
        expect(onUserUpdated).toHaveBeenCalledWith(
          expect.objectContaining({
            projects: [projectA, projectB],
            projectIds: expect.arrayContaining(["proj-a", "proj-b"]) as string[],
          }),
        );
      });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(onMembershipsMoved).not.toHaveBeenCalled();
    });

    it("assigns a user without any project without a dialog", async () => {
      server.use(http.post("/api/v1/admin/projects/proj-b/users", () => HttpResponse.json([])));
      const { onUserUpdated, onMembershipsMoved } = renderDrawer();
      const user = userEvent.setup();

      await pickProjectB(user);

      await waitFor(() => {
        expect(onUserUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [projectB], projectIds: ["proj-b"] }),
        );
      });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(onMembershipsMoved).not.toHaveBeenCalled();
    });
  });
});
