import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { UserDetailsDrawer } from "../../../../src/features/admin/components/UserDetailsDrawer";
import type { AdminUser } from "../../../../src/features/admin/types";
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

function renderDrawer(overrides: Partial<AdminUser> = {}) {
  const onUserUpdated = vi.fn();
  const onMembershipsMoved = vi.fn();
  const onClose = vi.fn();
  const onOpenProjectDetails = vi.fn();
  const onRequestDelete = vi.fn();

  render(
    <UserDetailsDrawer
      user={{ ...userDetails, ...overrides }}
      availableProjects={[projectA, projectB]}
      isOpen
      onClose={onClose}
      onOpenProjectDetails={onOpenProjectDetails}
      onUserUpdated={onUserUpdated}
      onRequestDelete={onRequestDelete}
      onMembershipsMoved={onMembershipsMoved}
    />,
  );

  return { onUserUpdated, onClose, onOpenProjectDetails, onRequestDelete, onMembershipsMoved };
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

  describe("assigning a project", () => {
    async function pickProjectB(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: /Add project/i }));
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
