import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { SideBar } from "../../../src/components/layout/SideBar";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="32" height="32" />,
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "user123",
      username: "Test User",
      email: "test@example.com",
      permissionGroup: "ADMIN",
      projectRoles: [],
      profileIcon: "Test",
    },
    logout: vi.fn(),
    status: "authenticated",
  }),
}));

vi.mock("../../../src/context/useTheme", () => ({
  useTheme: () => ({
    isDarkMode: false,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => ({
    projects: [],
    selectedProject: null,
    selectedProjectId: "",
    canManageSelected: false,
    isSwitcherEnabled: true,
    isLoading: false,
    errorMessage: null,
    setSelectedProjectId: vi.fn(),
    reloadProjects: vi.fn(),
  }),
}));

describe("SideBar Accessibility", () => {
  it("has no axe violations and keeps the closed mobile sidebar out of the tab flow", async () => {
    const user = userEvent.setup();
    const { baseElement, container } = render(
      <MemoryRouter>
        <main>
          <SideBar />
        </main>
      </MemoryRouter>,
    );

    const mobileSidebar = container.querySelector('[aria-label="Mobile Sidebar"]');
    expect(mobileSidebar).toHaveAttribute("aria-hidden", "true");
    expect(mobileSidebar).toHaveAttribute("inert");

    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("button", { name: "Open sidebar" }));

    await waitFor(() => {
      expect(mobileSidebar).toHaveAttribute("aria-hidden", "false");
      expect(mobileSidebar).not.toHaveAttribute("inert");
    });
    expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("has no axe violations folded to icons either", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    const { baseElement } = render(
      <MemoryRouter>
        <main>
          <SideBar />
        </main>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
