import { render, screen } from "@testing-library/react";
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
  } = {
    profile: null,
    projectContext: null,
    onboarding: { state: "absent" },
    fetchFAQGroups: vi.fn(),
    fetchKnowledgeGaps: vi.fn(),
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
  knowledgeGapService: { fetchKnowledgeGaps: mocks.fetchKnowledgeGaps },
}));

const createProfile = (permissionGroup: PermissionGroup): UserProfile => ({
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
});

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
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
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
});
