import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { UsersTab } from "../../../src/features/admin/components/UsersTab";
import type { AdminUser } from "../../../src/features/admin/types";

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="40" height="40" />,
}));

const users: AdminUser[] = [
  {
    id: "u1",
    username: "asmith",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Smith",
    roles: [{ id: "r1", name: "Developer", description: "", type: "primary" }],
    permissionGroup: "Admin",
    projects: [{ id: "p1", name: "SprintStart" }],
    projectIds: ["p1"],
    enabled: true,
    profileIcon: "",
    hasCompletedOnboarding: true,
  },
  {
    id: "u2",
    username: "bjones",
    email: "bob@example.com",
    firstName: "Bob",
    lastName: "Jones",
    roles: [],
    permissionGroup: "User",
    projects: [],
    projectIds: [],
    enabled: false,
    profileIcon: "",
    hasCompletedOnboarding: false,
  },
];

describe("UsersTab Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <UsersTab
            paginatedUsers={users}
            selectedUserIds={new Set<string>(["u1"])}
            allVisibleUsersSelected={false}
            openUserMenuId={null}
            onToggleAllVisibleUsers={vi.fn()}
            onToggleUserSelection={vi.fn()}
            onOpenUserDetails={vi.fn()}
            onToggleUserContextMenu={vi.fn()}
            onOpenUserDetailsFromMenu={vi.fn()}
            onRequestUserDeleteFromMenu={vi.fn()}
          />
        </main>
      </MemoryRouter>,
    );

    expect(screen.getByRole("checkbox", { name: "Select all users" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox", { name: "Select Alice Smith" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Open details for Alice Smith" })).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Open context menu for Alice Smith" }),
    ).toHaveLength(1);

    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
