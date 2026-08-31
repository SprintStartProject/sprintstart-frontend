import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../../src/pages/DashboardPage";
import { PermissionGroup, type UserProfile } from "../../../src/services/types";
import type { ProjectContextValue } from "../../../src/features/projects/ProjectContext";
import type { MyOnboardingStatus } from "../../../src/features/onboarding/hooks/useMyOnboardingStatus";
import { createProjectContextValue, createSelectableProject } from "../setup/projectContext";

// Mutable so one file can render the dashboard for every role — who is signed in, and what
// therefore occupies the flexible slot, is the whole subject of the tests below.
const { mocks } = vi.hoisted(() => {
  // Spelled out rather than inferred: an inferred `onboarding` narrows to the state it was
  // initialised with, and no test could then move it to another one.
  const mocks: {
    profile: UserProfile | null;
    projectContext: ProjectContextValue | null;
    onboarding: MyOnboardingStatus;
    fetchFAQGroups: ReturnType<typeof vi.fn>;
    fetchKnowledgeGaps: ReturnType<typeof vi.fn>;
    fetchMyKnowledgeGaps: ReturnType<typeof vi.fn>;
  } = {
    profile: null,
    projectContext: null,
    onboarding: { state: "absent" },
    fetchFAQGroups: vi.fn(),
    fetchKnowledgeGaps: vi.fn(),
    fetchMyKnowledgeGaps: vi.fn(),
  };

  return { mocks };
});

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../src/features/onboarding/hooks/useMyOnboardingStatus", () => ({
  useMyOnboardingStatus: () => mocks.onboarding,
}));

vi.mock("../../../src/features/dashboard/components/NextStepWidget", () => ({
  NextStepWidget: () => <div data-testid="next-step-widget">Next step</div>,
}));

vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({ celebrate: vi.fn(), flyby: vi.fn(), showRocketPet: false }),
}));

vi.mock("../../../src/services/faqService", () => ({
  insightsService: { fetchFAQGroups: mocks.fetchFAQGroups },
}));

vi.mock("../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGaps: mocks.fetchKnowledgeGaps,
    fetchMyKnowledgeGaps: mocks.fetchMyKnowledgeGaps,
  },
}));

const createProfile = (
  permissionGroup: PermissionGroup,
  overrides: Partial<UserProfile> = {},
): UserProfile => ({
  id: "user1",
  authId: "auth-user1",
  username: "Test",
  email: "test@test.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [],
  projectIds: [],
  permissionGroup,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: false,
  ...overrides,
});

/** A member whose onboarding is still running — the case the catalog offers that widget for. */
const ONBOARDING_IN_PROGRESS: Partial<UserProfile> = {
  projectRoles: [{ id: "role1", name: "Developer" }],
  hasCompletedOnboarding: false,
};

const manager = {
  id: "manager1",
  username: "pm",
  email: "pm@example.com",
  firstName: "Pat",
  lastName: "Manager",
};

const createGap = (component: string, severity: "high" | "medium" | "low") => ({
  id: `${component}-${severity}`,
  component,
  missingTypes: [],
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-01T00:00:00Z",
  owners: [],
  severity,
});

/** A PM who manages the selected project — the case that qualifies for team insights. */
function signInAsManagingPm() {
  const project = createSelectableProject({ id: "1", name: "Test Project", manager });
  mocks.profile = createProfile(PermissionGroup.PM);
  mocks.projectContext = createProjectContextValue({
    projects: [project],
    selectedProject: project,
    selectedProjectId: "1",
    canManageSelected: true,
  });
}

function renderPage() {
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The arrangement is stored per user; a layout left behind by one test is another test's
    // starting state.
    window.localStorage.clear();

    const project = createSelectableProject({ id: "1", name: "Test Project", manager });
    mocks.profile = createProfile(PermissionGroup.USER);
    mocks.projectContext = createProjectContextValue({
      projects: [project],
      selectedProject: project,
      selectedProjectId: "1",
      canManageSelected: false,
    });
    mocks.onboarding = { state: "absent" };

    mocks.fetchFAQGroups.mockResolvedValue({
      groups: [
        { groupId: "g1", count: 4, question: "How do I deploy?", topDocuments: [] },
        { groupId: "g2", count: 3, question: "Where is the runbook?", topDocuments: [] },
      ],
    });
    mocks.fetchKnowledgeGaps.mockResolvedValue({
      gaps: [createGap("auth", "high"), createGap("auth", "low"), createGap("billing", "medium")],
    });
  });

  it("renders the dashboard with widgets", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Your conversations")).toBeInTheDocument();
  });

  describe("the flexible slot", () => {
    it("holds the conversations card for a user with no onboarding and nothing to manage", () => {
      renderPage();

      expect(screen.getByText("Your conversations")).toBeInTheDocument();
      expect(screen.queryByText("Team insights")).not.toBeInTheDocument();
      expect(mocks.fetchFAQGroups).not.toHaveBeenCalled();
    });

    it("holds the team insights for a PM who manages the selected project", async () => {
      signInAsManagingPm();

      renderPage();

      expect(await screen.findByText("Team insights")).toBeInTheDocument();
      expect(screen.queryByText("Your conversations")).not.toBeInTheDocument();
      expect(mocks.fetchFAQGroups).toHaveBeenCalledWith("1");
    });

    it("falls back to conversations for a PM who only belongs to the selected project", () => {
      mocks.profile = createProfile(PermissionGroup.PM);
      mocks.projectContext = createProjectContextValue({
        selectedProjectId: "1",
        canManageSelected: false,
      });

      renderPage();

      expect(screen.getByText("Your conversations")).toBeInTheDocument();
      expect(screen.queryByText("Team insights")).not.toBeInTheDocument();
    });

    it("keeps a running onboarding ahead of the team insights", () => {
      signInAsManagingPm();
      mocks.profile = createProfile(PermissionGroup.PM, ONBOARDING_IN_PROGRESS);
      mocks.onboarding = { state: "loading" };

      renderPage();

      expect(screen.getByTestId("next-step-widget")).toBeInTheDocument();
      expect(screen.queryByText("Team insights")).not.toBeInTheDocument();
    });
  });

  describe("team insights content", () => {
    beforeEach(() => {
      signInAsManagingPm();
    });

    it("puts the components carrying a gap in the middle of the ring", async () => {
      renderPage();

      expect(await screen.findByText("Team insights")).toBeInTheDocument();
      // Two gaps sit on `auth`, so three gaps span two components.
      expect(screen.getByText("components").previousSibling).toHaveTextContent("2");
      expect(screen.getByText("3 gaps")).toBeInTheDocument();
    });

    it("spells the severity split out below the ring, so it never rests on colour", async () => {
      renderPage();

      expect(await screen.findByText("1 High")).toBeInTheDocument();
      expect(screen.getByText("1 Medium")).toBeInTheDocument();
      expect(screen.getByText("1 Low")).toBeInTheDocument();
    });

    it("keeps the questions in their own column, most asked first", async () => {
      renderPage();

      const questions = await screen.findByRole("region", { name: "Recurring questions" });

      expect(questions).toHaveTextContent("7 asked");
      expect([...questions.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
        "How do I deploy?4",
        "Where is the runbook?3",
      ]);
    });

    it("says so plainly when there is nothing to report", async () => {
      mocks.fetchFAQGroups.mockResolvedValue({ groups: [] });
      mocks.fetchKnowledgeGaps.mockResolvedValue({ gaps: [] });

      renderPage();

      expect(await screen.findByText(/Nothing needs documenting/)).toBeInTheDocument();
      expect(screen.getByText("No recurring questions yet.")).toBeInTheDocument();
    });

    it("leads to the PM dashboard for the detail", async () => {
      renderPage();

      expect(
        await screen.findByRole("button", { name: /Open the PM Dashboard/ }),
      ).toBeInTheDocument();
    });
  });

  describe("edit mode", () => {
    /** The widgets on the board, in the order they are rendered. */
    function placedWidgets(): string[] {
      return screen
        .getAllByRole("button", { name: /^Remove / })
        .map((button) => button.getAttribute("aria-label")?.replace("Remove ", "") ?? "");
    }

    async function startEditing() {
      await userEvent.click(screen.getByRole("button", { name: "Edit dashboard" }));
    }

    it("keeps the editing controls out of the way until asked for", async () => {
      renderPage();

      expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();

      await startEditing();

      expect(placedWidgets()).toEqual([
        "Greeting",
        "Your conversations",
        "Knowledge base",
        "Ask the assistant",
        "Role and skills",
      ]);
    });

    it("takes a widget off the board and keeps it off across a remount", async () => {
      const { unmount } = render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>,
      );

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Remove Your conversations" }));

      expect(screen.queryByText("Your conversations")).not.toBeInTheDocument();

      unmount();
      renderPage();

      expect(screen.queryByText("Your conversations")).not.toBeInTheDocument();
    });

    it("offers a removed widget back in the picker", async () => {
      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Remove Knowledge base" }));
      await userEvent.click(screen.getByRole("button", { name: "Add widget" }));

      const picker = screen.getByTestId("add-widget-modal");
      // Only what is missing is offered — a widget already placed would be a no-op.
      expect(
        within(picker).getByRole("button", { name: "Add Knowledge base" }),
      ).toBeInTheDocument();
      expect(
        within(picker).queryByRole("button", { name: "Add Greeting" }),
      ).not.toBeInTheDocument();

      await userEvent.click(within(picker).getByRole("button", { name: "Add Knowledge base" }));

      expect(screen.queryByTestId("add-widget-modal")).not.toBeInTheDocument();
      expect(placedWidgets()).toContain("Knowledge base");
    });

    it("offers a widget only the sizes it looks right at", async () => {
      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("combobox", { name: "Size of Knowledge base" }));

      expect(screen.getByRole("option", { name: "Small" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Medium" })).toBeInTheDocument();
      // The knowledge base has no full-width form, so that step is never on offer.
      expect(screen.queryByRole("option", { name: "Wide" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("option", { name: "Small" }));

      expect(screen.getByRole("combobox", { name: "Size of Knowledge base" })).toHaveTextContent(
        "Small",
      );
    });

    it("moves a widget with the keyboard, for anyone who cannot drag one", async () => {
      renderPage();

      await startEditing();

      // Focused rather than clicked: the controls only surface on hover, and focus is what
      // reveals them for someone who never touches a pointer.
      screen.getByRole("button", { name: "Move Greeting later" }).focus();
      await userEvent.keyboard("{Enter}");

      expect(placedWidgets().slice(0, 2)).toEqual(["Your conversations", "Greeting"]);
    });

    it("puts the default layout back when the arrangement is reset", async () => {
      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Remove Greeting" }));
      expect(placedWidgets()).not.toContain("Greeting");

      await userEvent.click(screen.getByRole("button", { name: "Reset" }));

      const confirmation = screen.getByRole("alertdialog");
      await userEvent.click(within(confirmation).getByRole("button", { name: "Reset" }));

      expect(placedWidgets()).toContain("Greeting");
    });

    it("offers only what this user may have — an admin gets the organization widgets", async () => {
      mocks.profile = createProfile(PermissionGroup.ADMIN);

      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Add widget" }));

      const picker = screen.getByTestId("add-widget-modal");
      expect(within(picker).getByRole("button", { name: "Add User accounts" })).toBeInTheDocument();
      expect(within(picker).getByRole("button", { name: "Add Projects" })).toBeInTheDocument();
    });

    it("offers a plain user the widgets the default layout leaves out", async () => {
      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Add widget" }));

      // Everything else a plain user may have is already on the default board; the knowledge
      // gaps assigned to them are opt-in, because most people own no component at all.
      const picker = screen.getByTestId("add-widget-modal");
      expect(
        within(picker).getByRole("button", { name: "Add Your knowledge gaps" }),
      ).toBeInTheDocument();
      expect(
        within(picker).queryByRole("button", { name: "Add User accounts" }),
      ).not.toBeInTheDocument();
    });

    it("offers a manager their team widgets, and never the organization ones", async () => {
      signInAsManagingPm();

      renderPage();

      await startEditing();
      await userEvent.click(screen.getByRole("button", { name: "Add widget" }));

      const picker = screen.getByTestId("add-widget-modal");
      expect(within(picker).getByRole("button", { name: "Add Team overview" })).toBeInTheDocument();
      expect(
        within(picker).queryByRole("button", { name: "Add User accounts" }),
      ).not.toBeInTheDocument();
      expect(
        within(picker).queryByRole("button", { name: "Add Projects" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("easter egg", () => {
    it("renders the header icon with eggHint enabled", () => {
      renderPage();

      const iconButton = screen.getByRole("button", { name: "Dashboard icon" });
      expect(iconButton).toHaveAttribute("data-egg-hint", "true");
    });

    it("opens the 2048 game modal after three clicks on the header icon", async () => {
      renderPage();

      const iconButton = screen.getByRole("button", { name: "Dashboard icon" });
      expect(screen.queryByRole("dialog", { name: "2048" })).not.toBeInTheDocument();

      await userEvent.click(iconButton);
      await userEvent.click(iconButton);
      await userEvent.click(iconButton);

      expect(screen.getByRole("dialog", { name: "2048" })).toBeInTheDocument();
    });
  });
});
