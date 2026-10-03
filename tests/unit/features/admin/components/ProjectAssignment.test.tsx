import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiProjectAssignment } from "../../../../../src/features/admin/components/MultiProjectAssignment";
import { SingleProjectAssignment } from "../../../../../src/features/admin/components/SingleProjectAssignment";
import type { AdminUser, ProjectOverview } from "../../../../../src/features/admin/types";

const project = (id: string, name: string): ProjectOverview => ({
  id,
  name,
  description: "",
  manager: null,
  sources: [],
  users: [],
  industry: "",
  industryConfidence: null,
  industryCustom: false,
});

const alpha = project("proj-1", "Alpha");
const beta = project("proj-2", "Beta");
const gamma = project("proj-3", "Gamma");

const user: AdminUser = {
  id: "u-1",
  username: "jd",
  email: "jd@example.com",
  firstName: "Jane",
  lastName: "Doe",
  roles: [],
  permissionGroup: "User",
  projects: [],
  projectIds: [],
  enabled: true,
  profileIcon: "",
  hasCompletedOnboarding: false,
};

const assigned = (entry: ProjectOverview) => ({ id: entry.id, name: entry.name, overview: entry });

describe("project assignment views", () => {
  const callbacks = {
    onOpenProjectDetails: vi.fn(),
    onAssignProject: vi.fn().mockResolvedValue(undefined),
    onRemoveProject: vi.fn().mockResolvedValue(undefined),
  };
  const common = { user, allProjects: [alpha, beta, gamma], usersById: new Map(), ...callbacks };

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks.onAssignProject.mockResolvedValue(undefined);
    callbacks.onRemoveProject.mockResolvedValue(undefined);
  });

  describe("SingleProjectAssignment", () => {
    it("skips the assignment when confirmAssign resolves false", async () => {
      const user = userEvent.setup();
      const confirmAssign = vi.fn().mockResolvedValue(false);
      render(
        <SingleProjectAssignment
          {...common}
          assignedProjects={[assigned(alpha)]}
          confirmAssign={confirmAssign}
        />,
      );

      await user.click(screen.getByRole("button", { name: /Move to another project/i }));
      await user.click(screen.getByText("Beta"));

      await waitFor(() => expect(confirmAssign).toHaveBeenCalledWith("proj-2"));
      expect(callbacks.onAssignProject).not.toHaveBeenCalled();
    });

    it("assigns the project when confirmAssign resolves true", async () => {
      const user = userEvent.setup();
      render(
        <SingleProjectAssignment
          {...common}
          assignedProjects={[assigned(alpha)]}
          confirmAssign={vi.fn().mockResolvedValue(true)}
        />,
      );

      await user.click(screen.getByRole("button", { name: /Move to another project/i }));
      await user.click(screen.getByText("Beta"));

      await waitFor(() => expect(callbacks.onAssignProject).toHaveBeenCalledWith("proj-2"));
    });

    it("says which project a move replaces", async () => {
      const user = userEvent.setup();
      render(<SingleProjectAssignment {...common} assignedProjects={[assigned(alpha)]} />);

      await user.click(screen.getByRole("button", { name: /Move to another project/i }));

      expect(screen.getByText("Replaces Alpha")).toBeInTheDocument();
    });

    it("offers an assign button, not a move, for a user without a project", async () => {
      const user = userEvent.setup();
      render(<SingleProjectAssignment {...common} assignedProjects={[]} />);

      expect(screen.queryByRole("button", { name: /Move to another project/i })).toBeNull();

      await user.click(screen.getByRole("button", { name: "Assign project" }));
      await user.click(screen.getByText("Gamma"));

      await waitFor(() => expect(callbacks.onAssignProject).toHaveBeenCalledWith("proj-3"));
    });

    it("names the project in the dialog when one of several is removed", async () => {
      const actor = userEvent.setup();
      render(
        <SingleProjectAssignment
          {...common}
          assignedProjects={[assigned(alpha), assigned(beta)]}
        />,
      );

      await actor.click(screen.getByRole("button", { name: "Remove Beta" }));

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toHaveTextContent("Jane Doe will be removed from Beta.");
      expect(dialog).not.toHaveTextContent("no longer be in any project");
    });

    it("does not invent a manager for a project the list does not know", () => {
      render(
        <SingleProjectAssignment
          {...common}
          assignedProjects={[{ id: "gone", name: "Project gone", overview: null }]}
        />,
      );

      expect(screen.getByText("Project gone")).toBeInTheDocument();
      expect(screen.queryByText("No manager")).not.toBeInTheDocument();
    });
  });

  describe("MultiProjectAssignment", () => {
    it("adds a project via the picker", async () => {
      const user = userEvent.setup();
      render(
        <MultiProjectAssignment {...common} isAdmin={false} assignedProjects={[assigned(alpha)]} />,
      );

      await user.click(screen.getByRole("button", { name: /Add project/i }));
      await user.click(screen.getByText("Beta"));

      await waitFor(() => expect(callbacks.onAssignProject).toHaveBeenCalledWith("proj-2"));
    });

    it("does not offer the projects already joined", async () => {
      const user = userEvent.setup();
      render(
        <MultiProjectAssignment {...common} isAdmin={false} assignedProjects={[assigned(alpha)]} />,
      );

      await user.click(screen.getByRole("button", { name: /Add project/i }));

      expect(screen.queryByRole("button", { name: /^Alpha/ })).not.toBeInTheDocument();
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });

    it("shows an empty state without projects", () => {
      render(<MultiProjectAssignment {...common} isAdmin={false} assignedProjects={[]} />);

      expect(screen.getByText("No projects assigned")).toBeInTheDocument();
    });

    it("opens a project from its row", async () => {
      const user = userEvent.setup();
      render(
        <MultiProjectAssignment {...common} isAdmin={false} assignedProjects={[assigned(alpha)]} />,
      );

      await user.click(screen.getByRole("button", { name: "Open Alpha project details" }));

      expect(callbacks.onOpenProjectDetails).toHaveBeenCalledWith("proj-1");
    });
  });
});
