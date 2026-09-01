import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SideBar } from "../../../../src/components/layout/SideBar";
import * as useAuthHook from "../../../../src/context/useAuth";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { PermissionGroup } from "../../../../src/services/types";

// Mutable so individual tests can flip it mid-suite. Module-level mock
// factories cannot close over `let`, hence the `vi.hoisted` shared object
// (same pattern as `useChat.test.tsx`). Reset in `beforeEach`.
const { projectState } = vi.hoisted(() => ({
  projectState: { canManageSelected: true },
}));

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
        canManageSelected: projectState.canManageSelected,
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

function renderWithProviders(ui: React.ReactElement, at = "/") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <ThemeProvider>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
}

describe("SideBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.className = "";
    projectState.canManageSelected = true;
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
      profile: {
        ...mockProfile,
        hasCompletedOnboarding: false,
        projectRoles: [{ id: "role-1", name: "Backend Engineer" }],
      },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getAllByText("OnBoarding").length).toBeGreaterThan(0);
  });

  it("hides the OnBoarding entry until a role has been assigned", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      // No project role yet, so the backend has no path to generate from.
      // Linking to a page that can only fail is worse than not linking.
      profile: {
        ...mockProfile,
        hasCompletedOnboarding: false,
        projectRoles: [],
      },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.queryByText("OnBoarding")).not.toBeInTheDocument();
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

  it("hides the escalation inbox from a regular user", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.queryByText("Escalation Inbox")).not.toBeInTheDocument();
  });

  it("shows the escalation inbox to a PM managing the selected project", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, permissionGroup: PermissionGroup.PM },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    // The project context is mocked with `canManageSelected: true`, so the
    // manager-assignment gate passes and the entry renders.
    expect(screen.getAllByText("Escalation Inbox").length).toBeGreaterThan(0);
  });

  it("hides the escalation inbox from a PM who only has member access to the selected project", () => {
    projectState.canManageSelected = false;
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, permissionGroup: PermissionGroup.PM },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    // The route is manager-scoped: a member-only PM would land on an inbox
    // whose API requests fail with 403, so the entry stays hidden.
    expect(screen.queryByText("Escalation Inbox")).not.toBeInTheDocument();
  });

  it("activates only the Escalation Inbox entry on its own route", () => {
    const pmProfile = {
      ...mockProfile,
      permissionGroup: PermissionGroup.PM,
    };
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: pmProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    // The framer-motion test mock surfaces `layoutId` as `data-layout-id`,
    // rendered once per active entry. Two active entries here (the Escalation
    // Inbox via NavLink match plus a force-active PM Dashboard) would each
    // mount one pill sharing the same id. `initialEntries` (instead of the
    // helper's default `/` location) is what puts the route in the inbox.
    render(
      <MemoryRouter initialEntries={["/insights/knowledge-requests"]}>
        <ThemeProvider>
          <SideBar />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Escalation Inbox").length).toBeGreaterThan(0);

    // The sidebar mounts twice (desktop + mobile drawer), so there are two
    // pills in total -- but each instance must carry exactly ONE. A second
    // active entry in one instance would mean two shared-layout elements
    // fighting over the same id within it.
    const desktopNav = screen.getByRole("navigation", { name: "Desktop Navigation" });
    expect(desktopNav.querySelectorAll("[data-layout-id]")).toHaveLength(1);

    // The desktop instance is the one under assertion; `getAllByText` because
    // the mobile drawer renders the same labels a second time.
    const pmDashboardEntry = screen
      .getAllByText("PM Dashboard")
      .map((label) => label.closest("a"))
      .find((link) => desktopNav.contains(link));
    expect(pmDashboardEntry?.className).not.toContain("text-white");
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
      // Onboarding still open *and* a role assigned, so that entry is
      // present and everything below it sits one row lower.
      profile: {
        ...mockProfile,
        hasCompletedOnboarding: false,
        projectRoles: [{ id: "role-1", name: "Backend Engineer" }],
      },
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
  /**
   * The buddy is the other half of the chat's page, not a page of its own — one header, one
   * switch, two conversations. Before this the sidebar highlighted nothing at all on `/buddy`,
   * so the app claimed the hire was nowhere while they were looking at half of Chat.
   */
  it("keeps the Chat entry lit while the buddy half is open", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      profile: mockProfile,
    } as unknown as ReturnType<typeof useAuthHook.useAuth>);

    renderWithProviders(<SideBar />, "/buddy");

    // `aria-current` is `NavLink`'s own "this is the page you are on", and `/buddy` is not
    // `/chat` — so this is the forced highlight, asserted the way a user perceives it.
    const chat = screen.getAllByRole("link", { name: /Chat/ })[0];
    expect(chat).not.toHaveAttribute("aria-current", "page");
    expect(chat.className).toContain("text-white");
  });
});
