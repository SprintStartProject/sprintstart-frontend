import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { SideBar } from "../../../../src/components/layout/SideBar";
import * as useAuthHook from "../../../../src/context/useAuth";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { PermissionGroup } from "../../../../src/services/types";
import { knowledgeRequestService } from "../../../../src/services/knowledgeRequestService";
import { getPmAttentionCount } from "../../../../src/services/teamManagementService";
import { mockViewport } from "../../setup/matchMedia";

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

// The escalation count is a real read now. Mocked here rather than left to
// hit the network, and asserted on below: the sidebar renders twice at once,
// so "who owns the request" is a thing this suite has to keep honest.
vi.mock("../../../../src/services/knowledgeRequestService", () => ({
  knowledgeRequestService: { countOpen: vi.fn() },
  onOpenEscalationsChanged: () => () => {},
}));

// The other half of the PM Dashboard's number: pending skip requests and unread feedback. The
// emitter is kept real so a skip decision or a read feedback can be announced mid-test.
const { attentionListeners } = vi.hoisted(() => ({ attentionListeners: new Set<() => void>() }));
vi.mock("../../../../src/services/teamManagementService", () => ({
  getPmAttentionCount: vi.fn(),
  onPmAttentionChanged: (listener: () => void) => {
    attentionListeners.add(listener);
    return () => attentionListeners.delete(listener);
  },
}));

const attention = (pendingSkips: number, unreadFeedback: number) => ({
  pendingSkips,
  unreadFeedback,
  total: pendingSkips + unreadFeedback,
});

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
    attentionListeners.clear();
    vi.mocked(getPmAttentionCount).mockResolvedValue(attention(0, 0));
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

  it("shows the OnBoarding entry before a role or path has been assigned", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
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

  it("leaves the escalation inbox to the PM dashboard instead of giving it an entry", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: { ...mockProfile, permissionGroup: PermissionGroup.PM },
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    // The inbox is a section of the PM dashboard now: a managing PM reaches it through the
    // dashboard's entry, and a separate entry would light up beside it.
    expect(screen.getAllByText("PM Dashboard").length).toBeGreaterThan(0);
    expect(screen.queryByText("Escalation Inbox")).not.toBeInTheDocument();
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

  it("activates the PM Dashboard entry, and only that one, inside the escalations section", () => {
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
    // rendered once per active entry. `initialEntries` (instead of the helper's
    // default `/` location) is what puts the route in the inbox section.
    render(
      <MemoryRouter initialEntries={["/insights/knowledge-requests"]}>
        <ThemeProvider>
          <SideBar />
        </ThemeProvider>
      </MemoryRouter>,
    );

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
    // The pill is what the sidebar highlights *with* — the same `[data-layout-id]` counted
    // above — so asserting on it survives any restyling of the entry itself.
    expect(pmDashboardEntry?.querySelector("[data-layout-id]")).not.toBeNull();
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
  it("moves focus into the mobile drawer, closes it on Escape and gives focus back", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);
    const drawer = () => document.querySelector<HTMLElement>('aside[aria-label="Mobile Sidebar"]')!;

    await user.click(screen.getByLabelText("Open sidebar"));
    await waitFor(() => expect(drawer().contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");

    expect(screen.getByLabelText("Open sidebar")).toHaveFocus();
  });

  /**
   * The count is owned by `SideBar`, not by `SidebarContent` — that renders
   * twice at once, once for the desktop rail and once for the mobile drawer,
   * so owning the read there would fire it twice on every page load and every
   * project switch. Same reason the PM attention count lives up there.
   */
  describe("open escalation count", () => {
    const asPm = () => {
      vi.mocked(useAuthHook.useAuth).mockReturnValue({
        status: "authenticated",
        profile: { ...mockProfile, permissionGroup: PermissionGroup.PM },
        login: vi.fn(),
        logout: vi.fn(),
        refetchProfile: vi.fn(),
      });
    };

    it("counts once for both sidebars", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);

      renderWithProviders(<SideBar />);

      await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalled());
      expect(knowledgeRequestService.countOpen).toHaveBeenCalledTimes(1);
    });

    it("counts escalations into the PM Dashboard entry's number", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(3);

      renderWithProviders(<SideBar />);

      // Once per sidebar: the desktop rail and the mobile drawer both render it.
      await waitFor(() => expect(screen.getAllByText("3").length).toBeGreaterThan(0));
      expect(
        screen.getAllByText("3 items need your attention: 3 open escalations").length,
      ).toBeGreaterThan(0);
    });

    it("adds pending skip requests and unread feedback, and says what the number is", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(1);
      vi.mocked(getPmAttentionCount).mockResolvedValue(attention(2, 1));

      renderWithProviders(<SideBar />);

      await waitFor(() => expect(screen.getAllByText("4").length).toBeGreaterThan(0));
      expect(
        screen.getAllByText(
          "4 items need your attention: 2 pending skip requests, 1 unread feedback, 1 open escalation",
        ).length,
      ).toBeGreaterThan(0);
      expect(getPmAttentionCount).toHaveBeenCalledTimes(1);
      expect(getPmAttentionCount).toHaveBeenCalledWith("proj1");
      // Open, the number carries no tooltip of its own: it would shadow the link's title
      // (name and chord). Folded to icons, its words become its title.
      expect(screen.getAllByText("4")[0].parentElement).not.toHaveAttribute("title");
    });

    it("shows no number when nothing is waiting", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);

      renderWithProviders(<SideBar />);

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalled());
      await waitFor(() => expect(knowledgeRequestService.countOpen).toHaveBeenCalled());
      expect(screen.queryByText(/need(s)? your attention/)).not.toBeInTheDocument();
      expect(screen.queryByText("Open skip requests, unread feedback or escalations")).toBeNull();
    });

    it("shows no number while part of it is still loading", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(2);
      vi.mocked(getPmAttentionCount).mockReturnValue(new Promise(() => {}));

      renderWithProviders(<SideBar />);

      // The known part still raises the marker, but no count claims to be the total.
      await waitFor(() =>
        expect(
          screen.getAllByText("Open skip requests, unread feedback or escalations").length,
        ).toBeGreaterThan(0),
      );
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("shows no number when the read fails", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);
      vi.mocked(getPmAttentionCount).mockRejectedValue(new Error("boom"));

      renderWithProviders(<SideBar />);

      await waitFor(() => expect(getPmAttentionCount).toHaveBeenCalled());
      expect(screen.queryByText(/need(s)? your attention/)).not.toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("updates after a skip decision or read feedback is announced", async () => {
      asPm();
      vi.mocked(knowledgeRequestService.countOpen).mockResolvedValue(0);
      vi.mocked(getPmAttentionCount).mockResolvedValue(attention(1, 1));

      renderWithProviders(<SideBar />);

      await waitFor(() => expect(screen.getAllByText("2").length).toBeGreaterThan(0));

      vi.mocked(getPmAttentionCount).mockResolvedValue(attention(0, 1));
      act(() => {
        attentionListeners.forEach((listener) => {
          listener();
        });
      });

      await waitFor(() =>
        expect(
          screen.getAllByText("1 item needs your attention: 1 unread feedback").length,
        ).toBeGreaterThan(0),
      );
      expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("never reads it for somebody who cannot open the inbox", () => {
      vi.mocked(useAuthHook.useAuth).mockReturnValue({
        status: "authenticated",
        profile: mockProfile,
        login: vi.fn(),
        logout: vi.fn(),
        refetchProfile: vi.fn(),
      });

      renderWithProviders(<SideBar />);

      expect(knowledgeRequestService.countOpen).not.toHaveBeenCalled();
      expect(getPmAttentionCount).not.toHaveBeenCalled();
    });
  });

  describe("desktop sidebar size", () => {
    const signIn = () =>
      vi.mocked(useAuthHook.useAuth).mockReturnValue({
        status: "authenticated",
        profile: mockProfile,
        login: vi.fn(),
        logout: vi.fn(),
        refetchProfile: vi.fn(),
      });
    const desktop = () => screen.getByRole("complementary", { name: "Desktop Sidebar" });
    // The width lives in a CSS variable on the root, which the page's margin reads as well.
    const sidebarWidth = () =>
      document.documentElement.style.getPropertyValue("--app-sidebar-desktop-width");
    // Closed, the drawer is `inert` and hidden from the accessibility tree, so no role query finds it.
    const mobile = () => document.querySelector<HTMLElement>('aside[aria-label="Mobile Sidebar"]')!;
    // The logo folds and unfolds it; the resize edge's Enter is the keyboard's way.
    const logo = () => desktop().querySelector<HTMLElement>("[data-drop-phase]")!;

    it("folds to icons, keeps every entry named, and remembers it", async () => {
      const user = userEvent.setup();
      signIn();
      const { unmount } = renderWithProviders(<SideBar />);

      await user.click(logo());

      expect(sidebarWidth()).toBe("76px");
      // Icon only, but still a link with its name.
      expect(within(desktop()).getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
      // The edge stays, to pull it open again.
      expect(within(desktop()).getByRole("separator")).toHaveAttribute(
        "aria-valuetext",
        "Collapsed",
      );

      unmount();
      renderWithProviders(<SideBar />);
      expect(sidebarWidth()).toBe("76px");
      expect(within(desktop()).getByRole("separator")).toHaveAttribute(
        "aria-valuetext",
        "Collapsed",
      );
    });

    it("folds the footer into one icon that slides the full card out", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);

      await user.click(logo());

      const trigger = within(desktop()).getByRole("button", { name: "Account and project" });
      const card = document.getElementById(trigger.getAttribute("aria-controls")!)!;
      expect(card).toHaveAttribute("inert");

      await user.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(card).not.toHaveAttribute("inert");
      expect(within(card).getByRole("button", { name: "Logout" })).toBeInTheDocument();
      expect(within(card).getByRole("link", { name: /^Settings/ })).toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(card).toHaveAttribute("inert");
    });

    it("leaves the shortcut chips off the folded rail, where they have no room", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);
      expect(within(desktop()).getAllByText("Alt + H").length).toBeGreaterThan(0);

      await user.click(logo());

      expect(within(desktop()).queryByText("Alt + H")).not.toBeInTheDocument();
      // Still named with its chord, as the link's own title.
      expect(within(desktop()).getByTitle("Dashboard (Alt + H)")).toBeInTheDocument();
    });

    it("shows an entry's name as a tooltip when it gets keyboard focus while folded", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);

      await user.click(logo());
      within(desktop())
        .getByRole("link", { name: /Dashboard/ })
        .focus();

      // Rendered into the page body so the nav cannot clip it.
      await waitFor(() =>
        expect(
          [...document.body.children].some(
            (child) => child.textContent === "Dashboard" && child.classList.contains("fixed"),
          ),
        ).toBe(true),
      );
    });

    it("resizes from the keyboard within its limits, and remembers the width", async () => {
      const user = userEvent.setup();
      signIn();
      const { unmount } = renderWithProviders(<SideBar />);

      const handle = within(desktop()).getByRole("separator", { name: "Resize sidebar" });
      expect(handle).toHaveAttribute("aria-valuenow", "286");

      handle.focus();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(sidebarWidth()).toBe("318px");

      await user.keyboard("{End}{ArrowRight}");
      expect(sidebarWidth()).toBe("400px");

      await user.keyboard("{Home}{ArrowLeft}");
      expect(sidebarWidth()).toBe("240px");

      unmount();
      renderWithProviders(<SideBar />);
      expect(within(desktop()).getByRole("separator")).toHaveAttribute("aria-valuenow", "240");
    });

    it("opens again from its edge while folded, at the width it had", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);

      const handle = within(desktop()).getByRole("separator", { name: "Resize sidebar" });
      handle.focus();
      await user.keyboard("{ArrowRight}{Enter}");
      expect(sidebarWidth()).toBe("76px");

      await user.keyboard("{ArrowLeft}");
      expect(sidebarWidth()).toBe("76px");

      await user.keyboard("{ArrowRight}");
      expect(sidebarWidth()).toBe("302px");
      expect(handle).toHaveAttribute("aria-valuetext", "302 pixels");

      await user.keyboard("{Enter}{Enter}");
      expect(sidebarWidth()).toBe("302px");
    });

    it("folds and unfolds from the logo, but not on the egg's quick repeat clicks", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);
      await user.click(logo());
      expect(sidebarWidth()).toBe("76px");

      // Straight after: counts towards the gravity egg, leaves the sidebar folded.
      await user.click(logo());
      expect(sidebarWidth()).toBe("76px");
    });

    it("leaves the mobile drawer as it was", async () => {
      const user = userEvent.setup();
      signIn();
      renderWithProviders(<SideBar />);

      await user.click(logo());

      expect(mobile()).toHaveClass("w-[var(--app-sidebar-width)]");
      expect(mobile().querySelector('[role="separator"]')).toBeNull();
    });
  });

  /**
   * The one conversation surface: the entry lights for every address of its page — the bare one
   * and a named conversation — because the entry now leads where the page lives. It used to need
   * a forced highlight while the entry pointed at `/chat` and the page rendered at `/buddy`.
   */
  it("keeps the Buddy entry lit on a conversation's address", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      profile: mockProfile,
    } as unknown as ReturnType<typeof useAuthHook.useAuth>);

    renderWithProviders(<SideBar />, "/buddy/conv-1");

    // `aria-current` is `NavLink`'s own "this is the page you are on", and on a child address
    // it says exactly that — no forcing involved.
    const buddy = screen.getAllByRole("link", { name: /Buddy/ })[0];
    expect(buddy).toHaveAttribute("aria-current", "page");

    // Asserted through the active pill rather than the entry's classes: the highlight is what
    // this test is about, and a class list is a styling decision that can change without it.
    expect(buddy.querySelector("[data-layout-id]")).not.toBeNull();
  });

  /**
   * The hint comes from the shortcuts registry (`navigationShortcut`), not from a string
   * typed at the call site — this asserts the pairing of entry and chord, which is the half
   * of "the hint and the keypress cannot disagree" a unit test can hold down.
   */
  it("advertises each destination's chord on the entry itself", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    // The chip is the visual half; the `title` is the copy a screen reader gets, which is
    // why both are asserted instead of the chip alone.
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute(
      "title",
      "Dashboard (Alt + H)",
    );
    // The desktop rail and the mobile drawer are two renders of one list, so compare counts.
    expect(screen.getAllByText("Alt + H").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alt + K").length).toBeGreaterThan(0);

    // The settings button is icon-only — no room for a chip — so its chord rides in the
    // accessible name, and `aria-label` is what makes that name, not the `title`.
    expect(screen.getAllByRole("link", { name: "Settings (Alt + ,)" }).length).toBeGreaterThan(0);
  });

  it("keeps the shortcut chip out of the link's accessible name", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getAllByText("Alt + H")[0]).toHaveAttribute("aria-hidden", "true");
    // And the name stays the label alone — a screen reader reads the chord from `title`.
    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });

  /**
   * Alt+S is the drawer's chord — the same state the header button works, reached without
   * leaving the keyboard. Asserted through the button's own name and `aria-expanded`, so the
   * test fails if the two ways in ever stop sharing one toggle.
   */
  it("gives Alt+S the same drawer the header button works", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(<SideBar />);

    expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await user.keyboard("{Alt>}s{/Alt}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );

    // It toggles rather than only opening: the same chord closes the drawer again.
    await user.keyboard("{Alt>}s{/Alt}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
  });

  it("does not answer Alt+S while a text field has the keys", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    renderWithProviders(
      <>
        <SideBar />
        <input aria-label="Notes" />
      </>,
    );

    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("{Alt>}s{/Alt}");

    expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("folds and unfolds the desktop sidebar with Alt+S on desktop widths, not the drawer", async () => {
    mockViewport(true);
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });
    const width = () =>
      document.documentElement.style.getPropertyValue("--app-sidebar-desktop-width");

    try {
      renderWithProviders(<SideBar />);

      await user.keyboard("{Alt>}s{/Alt}");
      expect(width()).toBe("76px");
      // The drawer is not on screen above `lg`, so its state must not flip behind the scenes.
      expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      await user.keyboard("{Alt>}s{/Alt}");
      expect(width()).toBe("286px");
    } finally {
      mockViewport(false);
    }
  });

  it("closes the drawer when the route changes without a link click", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      status: "authenticated",
      profile: mockProfile,
      login: vi.fn(),
      logout: vi.fn(),
      refetchProfile: vi.fn(),
    });

    function RouteChanger() {
      const navigate = useNavigate();

      return (
        <button type="button" onClick={() => void navigate("/board")}>
          Go to board
        </button>
      );
    }

    renderWithProviders(
      <>
        <SideBar />
        <RouteChanger />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Open sidebar" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );

    // A chord moves the route without `onNavigate` ever running — the drawer must not be
    // left standing open, with its overlay, over the new page.
    await user.click(screen.getByRole("button", { name: "Go to board" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open sidebar" })).toHaveAttribute(
        "aria-expanded",
        "false",
      ),
    );
  });
});
