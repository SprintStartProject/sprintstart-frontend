import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MyKnowledgeGapsWidget } from "../../../../src/features/dashboard/components/MyKnowledgeGapsWidget";
import type { KnowledgeGap } from "../../../../src/features/knowledge-gaps/types";
import { PermissionGroup, type UserProfile } from "../../../../src/services/types";
import type { ProjectContextValue } from "../../../../src/features/projects/ProjectContext";
import { createProjectContextValue, createSelectableProject } from "../../setup/projectContext";

const { mocks } = vi.hoisted(() => {
  const mocks: {
    profile: UserProfile | null;
    projectContext: ProjectContextValue | null;
    fetchMyKnowledgeGaps: ReturnType<typeof vi.fn>;
  } = {
    profile: null,
    projectContext: null,
    fetchMyKnowledgeGaps: vi.fn(),
  };

  return { mocks };
});

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.projectContext,
}));

vi.mock("../../../../src/services/knowledgeGapService", () => ({
  knowledgeGapService: { fetchMyKnowledgeGaps: mocks.fetchMyKnowledgeGaps },
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

const createGap = (
  component: string,
  severity: KnowledgeGap["severity"],
  missingTypes: string[] = ["runbook"],
): KnowledgeGap => ({
  id: `gap-${component}`,
  component,
  missingTypes,
  lastIngested: "2026-08-01T00:00:00Z",
  refreshedAt: "2026-08-10T00:00:00Z",
  owners: [],
  severity,
});

function signIn(permissionGroup: PermissionGroup, canManageSelected = false) {
  const project = createSelectableProject({ id: "1", name: "Test Project" });
  mocks.profile = createProfile(permissionGroup);
  mocks.projectContext = createProjectContextValue({
    projects: [project],
    selectedProject: project,
    selectedProjectId: "1",
    canManageSelected,
  });
}

function renderWidget(size: "small" | "medium" | "wide" = "medium") {
  render(
    <MemoryRouter>
      <MyKnowledgeGapsWidget size={size} />
    </MemoryRouter>,
  );
}

/** Lets the widget's `useFetch` resolve before anything is asserted. */
const settled = () => screen.findByText("Your knowledge gaps");

describe("MyKnowledgeGapsWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn(PermissionGroup.USER);
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({ gaps: [] });
  });

  it("tells a user who owns nothing that nothing is assigned to them", async () => {
    renderWidget();

    expect(await screen.findByText("Nothing assigned to you.")).toBeInTheDocument();
    // The whole point of the distinction: owning nothing is a success, not a failure.
    expect(screen.queryByText("Could not load your knowledge gaps.")).not.toBeInTheDocument();
  });

  it("keeps a failed load apart from owning nothing", async () => {
    mocks.fetchMyKnowledgeGaps.mockRejectedValue(new Error("boom"));

    renderWidget();

    expect(await screen.findByText("Could not load your knowledge gaps.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing assigned to you.")).not.toBeInTheDocument();
  });

  it("does not ask for gaps before a project is selected", async () => {
    mocks.projectContext = createProjectContextValue({
      projects: [],
      selectedProject: null,
      selectedProjectId: "",
      canManageSelected: false,
    });

    renderWidget();

    // `?projectId=` cannot bind to a UUID, so the request is never made — and the card says
    // what is actually going on rather than reporting a failure it caused itself.
    expect(await screen.findByText("No project selected.")).toBeInTheDocument();
    expect(mocks.fetchMyKnowledgeGaps).not.toHaveBeenCalled();
    expect(screen.queryByText("Could not load your knowledge gaps.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing assigned to you.")).not.toBeInTheDocument();
  });

  it("asks only for the selected project", async () => {
    renderWidget();

    await settled();
    expect(mocks.fetchMyKnowledgeGaps).toHaveBeenCalledWith("1");
  });

  it("names the worst component and what it lacks at small", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [createGap("frontend-portal", "low"), createGap("auth-service", "high", ["runbook"])],
    });

    renderWidget("small");

    // Worst first, and the quarter-row card shows that one alone — the other is counted.
    expect(await screen.findByText("auth-service")).toBeInTheDocument();
    expect(screen.queryByText("frontend-portal")).not.toBeInTheDocument();
    expect(screen.getByText("1 document missing")).toBeInTheDocument();
    expect(screen.getByText("and 1 more assigned to you")).toBeInTheDocument();
  });

  /*
    A single gap is the normal case, and the row built for a list of four left most of the
    card empty. At medium and wide it therefore gets the whole card: every missing type
    spelled out instead of capped, plus what the component already has.
  */
  it("gives a lone gap the whole card at medium", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [
        {
          ...createGap("auth-service", "high", ["runbook", "adr", "architecture-diagram"]),
          presentTypes: ["readme", "api-documentation"],
        },
      ],
    });

    renderWidget("medium");

    expect(await screen.findByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("Already documented")).toBeInTheDocument();
    // All three, not the three-chip cap the compact row applies.
    expect(screen.getByText("architecture-diagram")).toBeInTheDocument();
    expect(screen.getByText("readme")).toBeInTheDocument();
    expect(screen.getByText("3 documents missing")).toBeInTheDocument();
    expect(screen.getByText(/Last ingested/)).toBeInTheDocument();
  });

  it("gives a lone gap a third column at wide instead of the summary rail", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [
        {
          ...createGap("auth-service", "high", ["runbook"]),
          firstIngested: "2025-01-10T00:00:00Z",
          owners: [
            { id: "user1", username: "me", firstname: "Test", lastname: "User" },
            { id: "user2", username: "asmith", firstname: "Anna", lastname: "Smith" },
          ],
        },
      ],
    });

    renderWidget("wide");

    // A "1" over a single-colour bar said nothing the card does not already show, and it cost
    // a third of the width. The source column and co-owners fill it with real response data.
    expect(await screen.findByText("Source")).toBeInTheDocument();
    expect(screen.getByText("First ingested")).toBeInTheDocument();
    expect(screen.getByText("Last analyzed")).toBeInTheDocument();
    expect(screen.getByText("Shared with")).toBeInTheDocument();
    // The signed-in user is an owner by definition, so they are never their own "shared with".
    expect(screen.getByText("Anna Smith")).toBeInTheDocument();
    expect(screen.queryByText("component assigned to you")).not.toBeInTheDocument();
  });

  it("keeps the wide grid to four cells and counts the rest in the last one", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [
        createGap("a", "high"),
        createGap("b", "high"),
        createGap("c", "medium"),
        createGap("d", "medium"),
        createGap("e", "low"),
      ],
    });

    renderWidget("wide");

    // Three cards plus a counter tile: a fifth card, or a count on a line under the grid, had
    // to come out of the two rows' height — which cut the bottom row off.
    expect(await screen.findByText("and 2 more assigned to you")).toBeInTheDocument();
    expect(screen.getByRole("list").children).toHaveLength(4);
    expect(screen.queryByText("e")).not.toBeInTheDocument();
    // The rail still reports the true total, not the number of cells.
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("lists several gaps worst first at medium", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [
        createGap("frontend-portal", "low"),
        createGap("payment-service", "medium"),
        createGap("auth-service", "high"),
      ],
    });

    renderWidget("medium");

    await settled();
    const components = screen
      .getAllByText(/auth-service|payment-service|frontend-portal/)
      .map((element) => element.textContent);

    expect(components).toEqual(["auth-service", "payment-service", "frontend-portal"]);
  });

  it("adds the totals beside the list at wide", async () => {
    mocks.fetchMyKnowledgeGaps.mockResolvedValue({
      gaps: [
        createGap("auth-service", "high", ["runbook", "adr"]),
        createGap("payment-service", "medium", ["runbook"]),
      ],
    });

    renderWidget("wide");

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText("components assigned to you")).toBeInTheDocument();
    expect(screen.getByText("3 documents missing in total")).toBeInTheDocument();
  });

  it("offers no click-through to a user who cannot open the knowledge-gaps page", async () => {
    renderWidget();

    await settled();
    expect(screen.queryByRole("button", { name: "Open knowledge gaps" })).not.toBeInTheDocument();
  });

  it("leads a manager of the selected project to the knowledge-gaps page", async () => {
    signIn(PermissionGroup.PM, true);

    renderWidget();

    expect(await screen.findByRole("button", { name: "Open knowledge gaps" })).toBeInTheDocument();
  });
});
