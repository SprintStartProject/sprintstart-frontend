import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { UsersTab } from "../../../../src/features/admin/components/UsersTab";
import type { AdminUser } from "../../../../src/services/adminUserService";

describe("UsersTab", () => {
  const mockUsers: AdminUser[] = [
    {
      id: "1",
      username: "user1",
      email: "user1@example.com",
      firstName: "John",
      lastName: "Doe",
      roles: [],
      permissionGroup: "Admin",
      projects: [],
      projectIds: [],
      enabled: true,
      profileIcon: "",
      hasCompletedOnboarding: true,
    },
    {
      id: "2",
      username: "user2",
      email: "user2@example.com",
      firstName: "Jane",
      lastName: "Smith",
      roles: [],
      permissionGroup: "User",
      projects: [],
      projectIds: [],
      enabled: false,
      profileIcon: "",
      hasCompletedOnboarding: true,
    },
  ];

  const defaultProps = {
    paginatedUsers: mockUsers,
    selectedUserIds: new Set<string>(),
    allVisibleUsersSelected: false,
    openUserMenuId: null as string | null,
    onToggleAllVisibleUsers: vi.fn(),
    onToggleUserSelection: vi.fn(),
    onOpenUserDetails: vi.fn(),
    onToggleUserContextMenu: vi.fn(),
    onOpenUserDetailsFromMenu: vi.fn(),
    onRequestUserDeleteFromMenu: vi.fn(),
  };

  it("shows empty state when no users", () => {
    render(<UsersTab {...defaultProps} paginatedUsers={[]} />);
    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("renders user list", () => {
    render(<UsersTab {...defaultProps} />);

    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jane Smith").length).toBeGreaterThan(0);
    expect(screen.getAllByText("user1@example.com").length).toBeGreaterThan(0);
  });

  it("flags a user without a project with a badge", () => {
    render(<UsersTab {...defaultProps} />);

    expect(screen.getAllByText("No project")).toHaveLength(2);
  });

  it("shows a user's projects as chips and marks the ones they manage", () => {
    const withProjects: AdminUser[] = [
      {
        ...mockUsers[0],
        permissionGroup: "Project Manager",
        projects: [
          { id: "p1", name: "Alpha" },
          { id: "p2", name: "Beta" },
          { id: "p3", name: "Gamma" },
        ],
        projectIds: ["p1", "p2", "p3"],
      },
    ];
    const projects = [
      {
        id: "p1",
        name: "Alpha",
        description: "",
        manager: { id: "1", username: "u", email: "", firstName: "", lastName: "" },
        sources: [],
        users: [],
        industry: "",
        industryConfidence: null,
        industryCustom: false,
      },
    ];

    render(<UsersTab {...defaultProps} paginatedUsers={withProjects} projects={projects} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.queryByText("No project")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Manager" })).toHaveLength(1);
  });

  it("calls onToggleUserSelection when checkbox is clicked", async () => {
    const user = userEvent.setup();
    render(<UsersTab {...defaultProps} />);

    const checkboxes = screen.getAllByLabelText("Select John Doe");
    await user.click(checkboxes[0]);
    expect(defaultProps.onToggleUserSelection).toHaveBeenCalledWith("1");
  });

  it("calls onOpenUserDetails when row is clicked", async () => {
    const user = userEvent.setup();
    render(<UsersTab {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Open details for John Doe" }));
    expect(defaultProps.onOpenUserDetails).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("renders context menu and triggers delete", async () => {
    const user = userEvent.setup();
    render(<UsersTab {...defaultProps} openUserMenuId="1" />);

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);
    expect(defaultProps.onRequestUserDeleteFromMenu).toHaveBeenCalled();
  });
});
