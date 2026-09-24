import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { TeamMemberDetailPage } from "../../../src/pages/TeamMemberDetailPage";
import type { TeamOverviewUser, ProjectRole } from "../../../src/features/team-management/types";
import type { KnowledgeGap } from "../../../src/features/knowledge-gaps/types";
import { knowledgeGapService } from "../../../src/services/knowledgeGapService";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "pm1", firstName: "PM", lastName: "User" } }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const {
  mockGetTeamMember,
  mockGetTeamOverview,
  mockGetProjectRoles,
  mockGetUserSkillLevels,
  mockGetUserOnboardingPath,
  mockGetUserOnboardingFeedback,
  mockGetOnboardingTasksByStep,
  mockAssignProjectRoleToUser,
  mockUnassignProjectRoleFromUser,
  mockAcceptOnboardingSkipRequest,
  mockDenyOnboardingSkipRequest,
} = vi.hoisted(() => ({
  mockGetTeamMember: vi.fn(),
  mockGetTeamOverview: vi.fn(),
  mockGetProjectRoles: vi.fn(),
  mockGetUserSkillLevels: vi.fn(),
  mockGetUserOnboardingPath: vi.fn(),
  mockGetUserOnboardingFeedback: vi.fn(),
  mockGetOnboardingTasksByStep: vi.fn(),
  mockAssignProjectRoleToUser: vi.fn(),
  mockUnassignProjectRoleFromUser: vi.fn(),
  mockAcceptOnboardingSkipRequest: vi.fn(),
  mockDenyOnboardingSkipRequest: vi.fn(),
}));

vi.mock("../../../src/services/teamManagementService", () => ({
  getTeamMember: mockGetTeamMember,
  // The roster behind the previous/next member links.
  getTeamOverview: mockGetTeamOverview,
  getProjectRoles: mockGetProjectRoles,
  getUserSkillLevels: mockGetUserSkillLevels,
  getUserOnboardingPath: mockGetUserOnboardingPath,
  getUserOnboardingFeedback: mockGetUserOnboardingFeedback,
  getOnboardingTasksByStep: mockGetOnboardingTasksByStep,
  assignProjectRoleToUser: mockAssignProjectRoleToUser,
  unassignProjectRoleFromUser: mockUnassignProjectRoleFromUser,
  acceptOnboardingSkipRequest: mockAcceptOnboardingSkipRequest,
  denyOnboardingSkipRequest: mockDenyOnboardingSkipRequest,
  markOnboardingFeedbackRead: vi.fn(),
  deleteOnboardingStep: vi.fn(),
  deleteOnboardingTask: vi.fn(),
  createOnboardingStepForPhase: vi.fn(),
  createOnboardingTaskForStep: vi.fn(),
}));

vi.mock("../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: {
    fetchKnowledgeGaps: vi.fn().mockResolvedValue({ gaps: [] as KnowledgeGap[] }),
  },
}));

vi.mock("../../../src/components/common/UserAvatar", () => ({
  UserAvatar: () => <svg role="img" aria-label="User Avatar" width="56" height="56" />,
}));

vi.mock("../../../src/features/team-management/components/detail/MemberJourneySection", () => ({
  MemberJourneySection: () => <div data-testid="member-journey-section">Onboarding</div>,
}));

vi.mock("../../../src/features/team-management/components/detail/MemberGapsPanel", () => ({
  // Renders the components it was handed, so a test can assert which ones
  // reached the panel rather than only that the panel exists.
  MemberGapsPanel: ({ knowledgeGaps }: { knowledgeGaps: KnowledgeGap[] }) => (
    <div data-testid="member-gaps-panel">
      {knowledgeGaps.map((gap) => gap.component).join(",") || "Gaps"}
    </div>
  ),
}));

vi.mock("../../../src/features/team-management/components/detail/StepDetailsPanel", () => ({
  StepDetailsPanel: () => <div data-testid="step-details-panel">Step Details</div>,
}));

vi.mock("../../../src/features/team-management/components/detail/MemberDetailDialogs", () => ({
  MemberDetailDialogs: (props: {
    roleToRemove: ProjectRole | null;
    onConfirmRoleRemove: (role: ProjectRole) => void;
  }) => (
    <div data-testid="member-detail-dialogs">
      {props.roleToRemove && (
        <button onClick={() => props.onConfirmRoleRemove(props.roleToRemove!)}>
          Confirm Remove {props.roleToRemove.name}
        </button>
      )}
    </div>
  ),
}));

function createMockUser(overrides: Partial<TeamOverviewUser> = {}): TeamOverviewUser {
  return {
    userId: "user1",
    firstname: "Alice",
    lastname: "Smith",
    roles: [{ id: "role1", name: "Backend", description: "Backend developer" }],
    skills: [],
    progressPercentage: 0.5,
    currentPhase: { id: "p1", title: "Phase 1" },
    currentStep: {
      id: "s1",
      title: "Setup",
      startedAt: "2026-07-01T00:00:00Z",
      skip: {
        id: "skip1",
        stepId: "step1",
        status: "PENDING",
        reason: "Already know this",
        reviewComment: null,
        reviewedAt: null,
      },
    },
    hasFeedback: false,
    projects: [{ id: "proj1", name: "Project 1" }],
    ...overrides,
  };
}

const mockRoles: ProjectRole[] = [
  { id: "role1", name: "Backend", description: "Backend developer" },
  { id: "role2", name: "Frontend", description: "Frontend developer" },
];

describe("TeamMemberDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTeamMember.mockResolvedValue(createMockUser());
    mockGetTeamOverview.mockResolvedValue([createMockUser()]);
    mockGetProjectRoles.mockResolvedValue(mockRoles);
    mockGetUserSkillLevels.mockResolvedValue([]);
    mockGetUserOnboardingPath.mockResolvedValue({
      id: "path1",
      userId: "user1",
      createdAt: "",
      phases: [],
    });
    mockGetUserOnboardingFeedback.mockResolvedValue([]);
    mockGetOnboardingTasksByStep.mockResolvedValue([]);
    mockAssignProjectRoleToUser.mockResolvedValue(undefined);
    mockUnassignProjectRoleFromUser.mockResolvedValue(undefined);
    mockAcceptOnboardingSkipRequest.mockResolvedValue(undefined);
    mockDenyOnboardingSkipRequest.mockResolvedValue(undefined);
  });

  it("loads and displays member details", async () => {
    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alice Smith" })).toBeInTheDocument();
    });

    expect(mockGetTeamMember).toHaveBeenCalledWith("user1");
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("adds a role straight from the profile, without a dialog", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alice Smith" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "Choose a role to add" }));
    await user.click(await screen.findByRole("option", { name: "Frontend" }));

    await waitFor(() => {
      expect(mockAssignProjectRoleToUser).toHaveBeenCalledWith("user1", "role2");
    });
  });

  it("removes a role through the confirmation dialog", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alice Smith" })).toBeInTheDocument();
    });

    const removeButton = screen.getByRole("button", { name: "Remove Backend" });
    await user.click(removeButton);

    await waitFor(() => {
      expect(screen.getByText("Confirm Remove Backend")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Confirm Remove Backend"));

    await waitFor(() => {
      expect(mockUnassignProjectRoleFromUser).toHaveBeenCalledWith("user1", "role1");
    });
  });

  it("accepts a pending skip request", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    // Approve, not Accept: the same list, and the same words, as the member side panel.
    await user.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(mockAcceptOnboardingSkipRequest).toHaveBeenCalledWith("skip1", "");
    });
  });

  it("declines a pending skip request", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Deny" }));

    await waitFor(() => {
      expect(mockDenyOnboardingSkipRequest).toHaveBeenCalledWith("skip1", "");
    });
  });

  /**
   * The decision cannot be retried once it is in, and the same request is answerable from a
   * second surface, so the page holds one in-flight answer per skip.
   */
  it("answers a skip request once, however fast the PM clicks", async () => {
    const user = userEvent.setup();
    // Never settles: the point is what the other controls do while one answer is in flight,
    // and `beforeEach` puts the resolving mock back for the next test.
    mockAcceptOnboardingSkipRequest.mockImplementation(() => new Promise<void>(() => {}));

    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "Approve" });

    const approve = screen.getByRole("button", { name: "Approve" });
    await user.click(approve);
    await user.click(approve);
    await user.click(screen.getByRole("button", { name: "Deny" }));

    expect(mockAcceptOnboardingSkipRequest).toHaveBeenCalledTimes(1);
    expect(mockDenyOnboardingSkipRequest).not.toHaveBeenCalled();
  });

  /**
   * The decision is in, but both surfaces still draw the request as pending until the refresh
   * lands -- and if the refresh never lands, they draw it for good. Enabling them again in the
   * meantime invites a second decision against a request the server has already answered.
   */
  it("keeps the answered request locked when the refresh that should clear it fails", async () => {
    const user = userEvent.setup();
    mockAcceptOnboardingSkipRequest.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "Approve" });

    // Only the refresh that follows the decision fails; the page itself loaded.
    mockGetTeamMember.mockRejectedValueOnce(new Error("gateway"));

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockAcceptOnboardingSkipRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "Deny" })).toBeDisabled();
  });

  // The knowledge-gaps overview is the project's full component roster now, but
  // this panel is headed "Knowledge gaps" -- listing repositories that are
  // missing nothing would overstate what the member has to answer for.
  it("keeps covered components out of the member's gaps panel", async () => {
    const gap = (component: string, severity: KnowledgeGap["severity"]): KnowledgeGap => ({
      id: component,
      component,
      missingTypes: severity === "covered" ? [] : ["readme"],
      lastIngested: new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      owners: [],
      severity,
    });
    vi.mocked(knowledgeGapService.fetchKnowledgeGaps).mockResolvedValue({
      gaps: [gap("auth-service", "high"), gap("docs-wiki", "covered")],
    });

    render(
      <MemoryRouter>
        <TeamMemberDetailPage userId="user1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("member-gaps-panel")).toHaveTextContent("auth-service");
    });
    expect(screen.getByTestId("member-gaps-panel")).not.toHaveTextContent("docs-wiki");
  });
});

// These components read the selected project to scope their requests; the hook
// throws outside a ProjectProvider, so it is stubbed rather than provider-wrapped.
vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
      }),
  };
});
