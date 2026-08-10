import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SideBar } from "../../../../src/components/layout/SideBar";
import * as useAuthHook from "../../../../src/context/useAuth";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { PermissionGroup } from "../../../../src/services/types";

vi.mock("../../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
      }),
  };
});

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockProfile = {
  id: "1",
  authId: "auth",
  username: "TestUser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: [],
  permissionGroup: PermissionGroup.USER,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: true,
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
}

describe("SideBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.className = "";
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      // Framer Motion's `useReducedMotion` (used by the sidebar nav items)
      // subscribes to the media query, so the mock needs the listener API.
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders basic nav items for regular user", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.queryByText("Access Management")).not.toBeInTheDocument();
  });

  it("hides the OnBoarding entry once onboarding is completed", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, hasCompletedOnboarding: true },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.queryByText("OnBoarding")).not.toBeInTheDocument();
  });

  it("shows the OnBoarding entry while onboarding is still open", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, hasCompletedOnboarding: false },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getAllByText("OnBoarding").length).toBeGreaterThan(0);
  });

  it("renders admin nav items for admin user", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, permissionGroup: PermissionGroup.ADMIN },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getAllByText("Access Management").length).toBeGreaterThan(0);
  });

  /**
   * The sliding pill animates by measuring where the previous one sat, which
   * only holds while the entry list does. It does not: the Project Manager
   * section appears once the project context finishes loading, shifting every
   * entry below it down a row. Navigating in that window used to leave the
   * pill travelling in from the wrong side.
   *
   * Tying the visible paths into the shared-layout id means a changed list is
   * a different element, so the pill is placed rather than animated from a
   * position that no longer exists.
   */
  it("gives the active pill a different shared-layout id when the entries change", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    // Re-rendered in place rather than remounted: `useId` hands out a fresh
    // instance id to a new tree, so a mount/unmount pair would show two
    // different ids whether or not the entry list is part of them -- and
    // the test would pass with the fix reverted.
    const { rerender } = renderWithProviders(<SideBar />);
    const withoutOnboarding = document
      .querySelector("[data-layout-id]")
      ?.getAttribute("data-layout-id");

    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      // Onboarding still open, so that entry is present and everything
      // below it sits one row lower.
      profile: { ...mockProfile, hasCompletedOnboarding: false },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    rerender(
      <MemoryRouter>
        <ThemeProvider>
          <SideBar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const withOnboarding = document
      .querySelector("[data-layout-id]")
      ?.getAttribute("data-layout-id");

    expect(withoutOnboarding).toBeTruthy();
    expect(withOnboarding).toBeTruthy();
    expect(withOnboarding).not.toBe(withoutOnboarding);
  });

  it("handles mobile sidebar toggling", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    await user.click(screen.getByLabelText("Open sidebar"));

    expect(screen.getByLabelText("Close sidebar")).toBeInTheDocument();
    expect(screen.getByLabelText("Close sidebar overlay")).toBeInTheDocument();
  });
});
