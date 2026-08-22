import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DataIngestionPage } from "../../../src/pages/DataIngestionPage";
import { createProjectContextValue, createSelectableProject } from "../setup/projectContext";

const { mockUseProjectContext } = vi.hoisted(() => ({ mockUseProjectContext: vi.fn() }));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: mockUseProjectContext,
}));

/** Points the mocked context at a project the current user manages (or not). */
function selectProject(overrides = {}) {
  const project = createSelectableProject({ id: "proj1", isManaged: true, ...overrides });
  mockUseProjectContext.mockReturnValue(
    createProjectContextValue({
      projects: [project],
      selectedProject: project,
      selectedProjectId: "proj1",
      canManageSelected: project.isManaged,
    }),
  );
}

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: { id: "user1", firstName: "Test", lastName: "User", permissionGroup: "PM" },
  }),
}));

function createRunPage(items: unknown[] = [], overrides = {}) {
  return {
    items,
    page: {
      number: 1,
      size: 10,
      totalElements: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      hasNext: false,
      hasPrevious: false,
      ...overrides,
    },
  };
}

const {
  mockGetIngestionRunsPage,
  mockGetIngestionStatus,
  mockConnectGithubRepository,
  mockDiscoverRepositories,
  mockGetGithubPatNames,
  mockUpdateAllGithubRepositories,
  mockUpdateGithubRepository,
  mockGetAccessibleProject,
  mockGetIngestionSourceStatuses,
  mockGetUnifiedArtifacts,
  mockListConnectors,
  mockConfigureAllGithubRepositories,
} = vi.hoisted(() => ({
  mockGetIngestionRunsPage: vi.fn(),
  mockGetIngestionStatus: vi.fn(),
  mockConnectGithubRepository: vi.fn(),
  mockDiscoverRepositories: vi.fn(),
  mockGetGithubPatNames: vi.fn(),
  mockUpdateAllGithubRepositories: vi.fn(),
  mockUpdateGithubRepository: vi.fn(),
  mockGetAccessibleProject: vi.fn(),
  mockGetIngestionSourceStatuses: vi.fn(),
  mockGetUnifiedArtifacts: vi.fn(),
  mockListConnectors: vi.fn(),
  mockConfigureAllGithubRepositories: vi.fn(),
}));

vi.mock("../../../src/services/ingestionService", () => ({
  getIngestionRunsPage: mockGetIngestionRunsPage,
  getIngestionStatus: mockGetIngestionStatus,
  getIngestionSourceStatuses: mockGetIngestionSourceStatuses,
}));

vi.mock("../../../src/services/projectService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: { ...actual.projectService, getAccessibleProject: mockGetAccessibleProject },
  };
});

vi.mock("../../../src/services/sources/githubService", () => ({
  connectGithubRepository: mockConnectGithubRepository,
  discoverRepositories: mockDiscoverRepositories,
  getGithubPatNames: mockGetGithubPatNames,
  updateAllGithubRepositories: mockUpdateAllGithubRepositories,
  updateGithubRepository: mockUpdateGithubRepository,
  configureAllGithubRepositories: mockConfigureAllGithubRepositories,
}));

const { mockGetJiraInstances, mockUpdateJiraInstance, mockConfigureAllJiraInstances } = vi.hoisted(
  () => ({
    mockGetJiraInstances: vi.fn(),
    mockUpdateJiraInstance: vi.fn(),
    mockConfigureAllJiraInstances: vi.fn(),
  }),
);

vi.mock("../../../src/services/sources/jiraService", () => ({
  getJiraInstances: mockGetJiraInstances,
  updateJiraInstance: mockUpdateJiraInstance,
  configureAllJiraInstances: mockConfigureAllJiraInstances,
}));

vi.mock("../../../src/services/connectorService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/services/connectorService")>();
  return {
    ...actual,
    connectorService: { ...actual.connectorService, listConnectors: mockListConnectors },
  };
});

vi.mock("../../../src/services/knowledgeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/services/knowledgeService")>();
  return {
    ...actual,
    knowledgeService: { ...actual.knowledgeService, getUnifiedArtifacts: mockGetUnifiedArtifacts },
  };
});

describe("DataIngestionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIngestionRunsPage.mockResolvedValue(createRunPage());
    mockGetIngestionStatus.mockResolvedValue([]);
    mockGetGithubPatNames.mockResolvedValue(["token1"]);
    mockConnectGithubRepository.mockResolvedValue({ transactionId: "tx1" });
    mockDiscoverRepositories.mockResolvedValue({
      repositories: [],
      hasMore: false,
      resolvedOwnerType: "user",
    });
    mockUpdateAllGithubRepositories.mockResolvedValue({ transactionId: "tx2" });
    mockUpdateGithubRepository.mockResolvedValue({ transactionId: "tx3" });
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [{ id: "src1", name: "octocat/hello-world", type: "GITHUB", status: "CONNECTED" }],
      users: [],
    });
    mockGetIngestionSourceStatuses.mockResolvedValue([]);
    mockGetJiraInstances.mockResolvedValue([]);
    mockUpdateJiraInstance.mockResolvedValue({ transactionId: "jira-tx" });
    mockConfigureAllGithubRepositories.mockResolvedValue(undefined);
    mockConfigureAllJiraInstances.mockResolvedValue(undefined);
    mockGetUnifiedArtifacts.mockResolvedValue([]);
    mockListConnectors.mockResolvedValue([]);
    selectProject();
  });

  it("renders the section filter after loading", async () => {
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /filter sections/i })).toBeInTheDocument();
    });

    const filter = within(screen.getByRole("group", { name: /filter sections/i }));
    expect(filter.getByRole("button", { name: /overview/i })).toBeInTheDocument();
    expect(filter.getByRole("button", { name: /sources/i })).toBeInTheDocument();
    expect(filter.getByRole("button", { name: /runs/i })).toBeInTheDocument();
  });

  it("lists the project sources fetched from the accessible-project endpoint", async () => {
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("octocat/hello-world")).length).toBeGreaterThan(0);
    expect(mockGetAccessibleProject).toHaveBeenCalledWith("proj1");
  });

  it("builds the GitHub source card from the per-repo ingestion status endpoint", async () => {
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "GITHUB",
        sourceId: "octocat/hello-world",
        repositoryId: "repo-uuid",
        owner: "octocat",
        name: "hello-world",
        sourceUrl: "https://github.com/octocat/hello-world",
        status: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 12,
        updatedCount: 7,
        deletedCount: 1,
        failedCount: 0,
        failedItems: [],
        artifactCount: 340,
        lastCommitsSyncAt: "2026-07-01T00:00:00Z",
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      },
    ]);

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    // Rendered both as the source card and in the overview's per-source breakdown.
    expect((await screen.findAllByText("octocat/hello-world")).length).toBeGreaterThan(0);

    // The repo's stored artifact count (#5) drives the card and the overview KPI,
    // instead of being counted from a full artifact snapshot.
    await waitFor(() => {
      expect(screen.getAllByText("340").length).toBeGreaterThan(0);
    });

    // Owner comes from the endpoint, not from parsed artifact metadata.
    expect(screen.getAllByText("octocat").length).toBeGreaterThan(0);
    expect(mockGetIngestionSourceStatuses).toHaveBeenCalledWith("proj1");
  });

  it("builds a Jira source card from the connector-neutral status row", async () => {
    // Jira is not a project source, so the card is driven purely by the
    // status endpoint (health/counters/artifact total); the instance DTO is
    // merged in only for the credential shown in the details panel.
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "JIRA",
        sourceId: "https://team.atlassian.net",
        displayName: "Team board",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://team.atlassian.net",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 5,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 128,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: "2026-07-01T00:00:00Z",
        lastPullRequestsSyncAt: null,
      },
    ]);
    mockGetJiraInstances.mockResolvedValue([
      {
        instanceUrl: "https://team.atlassian.net",
        displayName: "Team board",
        lastUpdate: "2026-07-01T00:00:00Z",
        projectIds: ["proj1"],
        sourceEnabled: true,
        status: "UP_TO_DATE",
        updateCredentialName: "default",
        updateCredentialUserEmail: "jira@corp.com",
      },
    ]);

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Team board")).length).toBeGreaterThan(0);

    // The instance's real stored-artifact total (from the status row) drives
    // the card and the overview KPI, no longer approximated from a run.
    await waitFor(() => {
      expect(screen.getAllByText("128").length).toBeGreaterThan(0);
    });
    expect(mockGetJiraInstances).toHaveBeenCalledWith("proj1");
  });

  it("does not double a Jira instance that is also exposed as a project source", async () => {
    // The backend now exposes connected Jira instances as project sources
    // (for the admin/project source lists), so the accessible-project list
    // contains the instance too. Jira cards are built solely from the
    // connector-neutral status rows, so the project source must not add a
    // second card for the same instance.
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [
        {
          id: "https://team.atlassian.net",
          name: "Team board",
          type: "JIRA",
          status: "CONNECTED",
        },
      ],
      users: [],
    });
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "JIRA",
        sourceId: "https://team.atlassian.net",
        displayName: "Team board",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://team.atlassian.net",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 5,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 128,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: "2026-07-01T00:00:00Z",
        lastPullRequestsSyncAt: null,
      },
    ]);
    mockGetJiraInstances.mockResolvedValue([
      {
        instanceUrl: "https://team.atlassian.net",
        displayName: "Team board",
        lastUpdate: "2026-07-01T00:00:00Z",
        projectIds: ["proj1"],
        sourceEnabled: true,
        status: "UP_TO_DATE",
        updateCredentialName: "default",
        updateCredentialUserEmail: "jira@corp.com",
      },
    ]);

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    // The overview KPI counts the single connected source, not two.
    const connectedSourcesKpi = await screen.findByRole("button", {
      name: /connected sources/i,
    });
    expect(within(connectedSourcesKpi).getByText("1")).toBeInTheDocument();
  });

  it("filters the run history to a Jira instance via sourceRef", async () => {
    // A GitHub repo (repositoryId) and a Jira instance (URL) together offer
    // two options in the source filter, so the dropdown appears.
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "GITHUB",
        sourceId: "octocat/hello-world",
        displayName: "octocat/hello-world",
        repositoryId: "repo-uuid",
        owner: "octocat",
        name: "hello-world",
        sourceUrl: "https://github.com/octocat/hello-world",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 1,
        updatedCount: 0,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 10,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      },
      {
        sourceSystem: "JIRA",
        sourceId: "https://team.atlassian.net",
        displayName: "Team board",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://team.atlassian.net",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 5,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 128,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: "2026-07-01T00:00:00Z",
        lastPullRequestsSyncAt: null,
      },
    ]);
    mockGetJiraInstances.mockResolvedValue([
      {
        instanceUrl: "https://team.atlassian.net",
        displayName: "Team board",
        lastUpdate: "2026-07-01T00:00:00Z",
        projectIds: ["proj1"],
        sourceEnabled: true,
        status: "UP_TO_DATE",
        updateCredentialName: "default",
        updateCredentialUserEmail: "jira@corp.com",
      },
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Filter runs by source" })).toBeInTheDocument();
    });

    // `FilterSelect` is a listbox, not a native <select>: open it, then pick the
    // instance by its display name.
    await user.click(screen.getByRole("combobox", { name: "Filter runs by source" }));
    await user.click(await screen.findByRole("option", { name: "Team board" }));

    // The Jira instance URL is sent as sourceRef, not repositoryId.
    await waitFor(() => {
      expect(mockGetIngestionRunsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sourceRef: "https://team.atlassian.net",
          repositoryId: undefined,
          page: 1,
        }),
      );
    });
  });

  /*
    The knowledge-gap detail page's "Update data source" button links here from a gap, and a gap
    knows itself by component — `owner/repo` — not by the project-source id these cards select
    by. Accepting both spellings is what opens the repository instead of dropping the reader on
    the list to find it again.
  */
  it("opens a source addressed by its component rather than its card id", async () => {
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "GITHUB",
        sourceId: "octocat/hello-world",
        repositoryId: "repo-uuid",
        owner: "octocat",
        name: "hello-world",
        sourceUrl: "https://github.com/octocat/hello-world",
        status: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 12,
        updatedCount: 7,
        deletedCount: 1,
        failedCount: 0,
        failedItems: [],
        artifactCount: 340,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/data-ingestion?sourceId=octocat/hello-world"]}>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    // The card's own id is the project-source id ("src1"), so this only resolves through the
    // repository's full name.
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("Ingestion")).toBeInTheDocument();
  });

  it("opens nothing for a component that is not connected", async () => {
    render(
      <MemoryRouter initialEntries={["/data-ingestion?sourceId=someone/absent-repo"]}>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /filter sections/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies a projectId deep link once and then releases the project switcher", async () => {
    const setSelectedProjectId = vi.fn();
    const project = createSelectableProject({ id: "proj1", isManaged: true });
    mockUseProjectContext.mockReturnValue(
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
        setSelectedProjectId,
      }),
    );

    let search = "";
    function SearchProbe() {
      search = useLocation().search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/data-ingestion?projectId=proj-from-admin"]}>
        <DataIngestionPage />
        <SearchProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(setSelectedProjectId).toHaveBeenCalledWith("proj-from-admin");
    });

    // The parameter is consumed: while it stayed in the URL every switch was
    // immediately forced back to the deep-linked project.
    await waitFor(() => {
      expect(search).not.toContain("projectId");
    });

    // The context still reports a different project (the user switched, or
    // the deep link never resolved) — that must not be overridden again.
    setSelectedProjectId.mockClear();
    await waitFor(() => {
      expect(setSelectedProjectId).not.toHaveBeenCalled();
    });
  });

  it("does not let one repository's failed run colour another repository", async () => {
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [
        { id: "src1", name: "octocat/healthy", type: "GITHUB", status: "CONNECTED" },
        { id: "src2", name: "octocat/broken", type: "GITHUB", status: "CONNECTED" },
      ],
      users: [],
    });

    const instance = (name: string, repositoryId: string, failedCount: number) => ({
      sourceSystem: "GITHUB",
      sourceId: `octocat/${name}`,
      repositoryId,
      owner: "octocat",
      name,
      sourceUrl: `https://github.com/octocat/${name}`,
      status: "CONNECTED",
      enabled: true,
      lastRunTime: "2026-07-01T00:00:00Z",
      ingestedCount: 5,
      updatedCount: 0,
      deletedCount: 0,
      failedCount,
      failedItems: [],
      artifactCount: 10,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: null,
      lastPullRequestsSyncAt: null,
    });

    mockGetIngestionSourceStatuses.mockResolvedValue([
      instance("healthy", "repo-healthy", 0),
      instance("broken", "repo-broken", 3),
    ]);

    // Only the broken repo has a failed run loaded.
    mockGetIngestionRunsPage.mockResolvedValue(
      createRunPage([
        {
          runId: "run-broken",
          sourceSystem: "GITHUB",
          sourceId: "octocat/broken",
          owner: "octocat",
          name: "broken",
          repositoryId: "repo-broken",
          startedAt: "2026-07-05T10:00:00Z",
          finishedAt: "2026-07-05T10:05:00Z",
          ingestedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          failedCount: 3,
          status: "FAILED",
          failedItems: [],
          failureReason: null,
          aiSyncStatus: "FAILED",
          aiSyncFailureReason: null,
        },
      ]),
    );

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    // Rendered both as a source card and in the overview breakdown.
    await screen.findAllByText("octocat/healthy");

    // Exactly one card needs attention — previously the newest GitHub run was
    // applied to every GitHub source, marking the healthy repo as failing too.
    // Scoped to the Sources section: the overview KPI carries the same label.
    await waitFor(() => {
      const sourcesSection = within(screen.getByRole("region", { name: "Sources" }));
      expect(sourcesSection.getAllByText("Needs attention")).toHaveLength(1);
      expect(sourcesSection.getAllByText("Connected").length).toBeGreaterThan(0);
    });
  });

  it("does not let one repository's failed run colour another repository", async () => {
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [
        { id: "src1", name: "octocat/healthy", type: "GITHUB", status: "CONNECTED" },
        { id: "src2", name: "octocat/broken", type: "GITHUB", status: "CONNECTED" },
      ],
      users: [],
    });

    const instance = (name: string, repositoryId: string, failedCount: number) => ({
      sourceSystem: "GITHUB",
      sourceId: `octocat/${name}`,
      repositoryId,
      owner: "octocat",
      name,
      sourceUrl: `https://github.com/octocat/${name}`,
      status: "CONNECTED",
      enabled: true,
      lastRunTime: "2026-07-01T00:00:00Z",
      ingestedCount: 5,
      updatedCount: 0,
      deletedCount: 0,
      failedCount,
      failedItems: [],
      artifactCount: 10,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: null,
      lastPullRequestsSyncAt: null,
    });

    mockGetIngestionSourceStatuses.mockResolvedValue([
      instance("healthy", "repo-healthy", 0),
      instance("broken", "repo-broken", 3),
    ]);

    // Only the broken repo has a failed run loaded.
    mockGetIngestionRunsPage.mockResolvedValue(
      createRunPage([
        {
          runId: "run-broken",
          sourceSystem: "GITHUB",
          sourceId: "octocat/broken",
          owner: "octocat",
          name: "broken",
          repositoryId: "repo-broken",
          startedAt: "2026-07-05T10:00:00Z",
          finishedAt: "2026-07-05T10:05:00Z",
          ingestedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          failedCount: 3,
          status: "FAILED",
          failedItems: [],
          failureReason: null,
          aiSyncStatus: "FAILED",
          aiSyncFailureReason: null,
        },
      ]),
    );

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    // Rendered both as a source card and in the overview breakdown.
    await screen.findAllByText("octocat/healthy");

    // Exactly one card needs attention — previously the newest GitHub run was
    // applied to every GitHub source, marking the healthy repo as failing too.
    // Scoped to the Sources section: the overview KPI carries the same label.
    await waitFor(() => {
      const sourcesSection = within(screen.getByRole("region", { name: "Sources" }));
      expect(sourcesSection.getAllByText("Needs attention")).toHaveLength(1);
      expect(sourcesSection.getAllByText("Connected").length).toBeGreaterThan(0);
    });
  });

  it("surfaces a globally disabled connector without opening the connectors modal", async () => {
    mockListConnectors.mockResolvedValue([
      {
        id: "github",
        name: "GitHub",
        enabled: false,
        firstConfiguredAt: null,
        lastConfiguredAt: null,
      },
    ]);
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "GITHUB",
        sourceId: "octocat/hello-world",
        repositoryId: "repo-uuid",
        owner: "octocat",
        name: "hello-world",
        sourceUrl: "https://github.com/octocat/hello-world",
        status: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 1,
        updatedCount: 0,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 5,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: null,
        lastPullRequestsSyncAt: null,
      },
    ]);

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    const sourcesSection = async () =>
      within(await screen.findByRole("region", { name: "Sources" }));

    // The card stops claiming to be connected even though the repository's
    // own flag is enabled — visible without opening the connectors modal.
    await waitFor(async () => {
      expect((await sourcesSection()).getAllByText("Connector disabled").length).toBeGreaterThan(0);
    });
    expect((await sourcesSection()).queryByText("Connected")).not.toBeInTheDocument();
  });

  it("shows no connector warning when the connector endpoint is forbidden", async () => {
    // HR may open the page but cannot read connectors — that must not be
    // mistaken for "everything is disabled".
    mockListConnectors.mockRejectedValue(new Error("Forbidden"));

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await screen.findAllByText("octocat/hello-world");
    expect(screen.queryByText("Connector disabled")).not.toBeInTheDocument();
  });

  it("scopes the run history to the selected project", async () => {
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGetIngestionRunsPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, size: 10, projectId: "proj1" }),
      );
    });
  });

  it("requests the next page when a pagination control is used", async () => {
    const run = (runId: string) => ({
      runId,
      sourceSystem: "GITHUB",
      sourceId: "octocat/hello-world",
      owner: "octocat",
      name: "hello-world",
      repositoryId: "repo-uuid",
      startedAt: "2026-07-05T10:00:00Z",
      finishedAt: "2026-07-05T10:05:00Z",
      ingestedCount: 1,
      updatedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      status: "COMPLETED",
      failedItems: [],
      failureReason: null,
      aiSyncStatus: "SUCCEEDED",
      aiSyncFailureReason: null,
    });

    mockGetIngestionRunsPage.mockResolvedValueOnce(
      createRunPage([run("run-page-1")], { totalElements: 2, totalPages: 2, hasNext: true }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("run-page-1")).toBeInTheDocument();

    mockGetIngestionRunsPage.mockResolvedValueOnce(
      createRunPage([run("run-page-2")], {
        number: 2,
        totalElements: 2,
        totalPages: 2,
        hasNext: false,
        hasPrevious: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(await screen.findByText("run-page-2")).toBeInTheDocument();
    // One page is shown at a time, so the previous page's rows are replaced.
    expect(screen.queryByText("run-page-1")).not.toBeInTheDocument();
    expect(mockGetIngestionRunsPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("keeps the newest response when refreshes resolve out of order", async () => {
    const run = (runId: string) => ({
      runId,
      sourceSystem: "GITHUB",
      sourceId: "octocat/hello-world",
      owner: "octocat",
      name: "hello-world",
      repositoryId: "repo-uuid",
      startedAt: "2026-07-05T10:00:00Z",
      finishedAt: "2026-07-05T10:05:00Z",
      ingestedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      status: "COMPLETED",
      failedItems: [],
      failureReason: null,
      aiSyncStatus: "SUCCEEDED",
      aiSyncFailureReason: null,
    });

    // A stale in-flight request resolves *after* a newer one. Its result must
    // be discarded, otherwise freshly created runs disappear again until the
    // user reloads the browser.
    let resolveStale: ((value: unknown) => void) | undefined;
    mockGetIngestionRunsPage
      .mockResolvedValueOnce(createRunPage([run("old-run")]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve;
          }),
      )
      .mockResolvedValueOnce(createRunPage([run("new-run")]));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("old-run")).toBeInTheDocument();

    const statusFilter = () => screen.getByRole("combobox", { name: "Filter runs by status" });
    await user.click(statusFilter());
    await user.click(await screen.findByRole("option", { name: "Failed" }));
    await user.click(statusFilter());
    await user.click(await screen.findByRole("option", { name: "Success" }));

    expect(await screen.findByText("new-run")).toBeInTheDocument();

    resolveStale?.(createRunPage([run("old-run")]));

    await waitFor(() => {
      expect(screen.getByText("new-run")).toBeInTheDocument();
    });
    expect(screen.queryByText("old-run")).not.toBeInTheDocument();
  });

  it("re-queries the backend with the chosen status filter", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Filter runs by status" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "Filter runs by status" }));
    await user.click(await screen.findByRole("option", { name: "Failed" }));

    await waitFor(() => {
      expect(mockGetIngestionRunsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "FAILED", page: 1 }),
      );
    });
  });

  it("opens and saves global Jira sync settings for a Jira-only project", async () => {
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [],
      users: [],
    });
    mockGetIngestionSourceStatuses.mockResolvedValue([
      {
        sourceSystem: "JIRA",
        sourceId: "https://team.atlassian.net",
        displayName: "Team board",
        repositoryId: null,
        owner: null,
        name: null,
        sourceUrl: "https://team.atlassian.net",
        connectionStatus: "CONNECTED",
        enabled: true,
        lastRunTime: "2026-07-01T00:00:00Z",
        ingestedCount: 5,
        updatedCount: 2,
        deletedCount: 0,
        failedCount: 0,
        failedItems: [],
        artifactCount: 128,
        lastCommitsSyncAt: null,
        lastIssuesSyncAt: "2026-07-01T00:00:00Z",
        lastPullRequestsSyncAt: null,
      },
    ]);
    mockGetJiraInstances.mockResolvedValue([
      {
        instanceUrl: "https://team.atlassian.net",
        displayName: "Team board",
        lastUpdate: "2026-07-01T00:00:00Z",
        projectIds: ["proj1"],
        sourceEnabled: true,
        status: "UP_TO_DATE",
        updateCredentialName: "default",
        updateCredentialUserEmail: "jira@example.com",
      },
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    const manageButton = await screen.findByRole("button", { name: /manage sync settings/i });
    await user.click(manageButton);

    expect(await screen.findByText("Jira Sync Settings")).toBeInTheDocument();
    expect(
      screen.queryByRole("tablist", { name: /sync settings connector/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: /toggle global jira auto update/i }));
    await user.click(screen.getByRole("button", { name: /apply globally/i }));

    await waitFor(() => {
      expect(mockConfigureAllJiraInstances).toHaveBeenCalledWith({
        autoUpdate: false,
        schedule: { type: "INTERVAL", everyMinutes: 60 },
      });
    });
    expect(mockConfigureAllGithubRepositories).not.toHaveBeenCalled();
  });

  it("opens the connectors modal from Manage connectors", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /manage connectors/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /manage connectors/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Enable or disable a connector, and choose which sources are in scope for this project.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("filters to the runs section when its control is clicked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("group", { name: /filter sections/i })).toBeInTheDocument();
    });

    const filter = () => within(screen.getByRole("group", { name: /filter sections/i }));
    await user.click(filter().getByRole("button", { name: /runs/i }));

    // `SegmentedTabs` draws the active fill as its own sliding element, so the
    // pressed state is what says "selected" — not a class on the button.
    expect(filter().getByRole("button", { name: /runs/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens the add-source modal and reaches GitHub discovery", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Add sources/i }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: /Add sources/i })[0]);

    // The modal opens straight on the type grid. Scope queries to the dialog so
    // GitHub-related controls on the page behind the portal don't collide.
    const dialog = within(await screen.findByRole("dialog"));

    // Type grid -> GitHub -> discovery.
    await user.click(await dialog.findByRole("button", { name: /github/i }));

    await waitFor(() => {
      expect(dialog.getByLabelText("Organization, user, or URL")).toBeInTheDocument();
    });
  });

  it("stages a discovered repository and connects it to the project", async () => {
    mockDiscoverRepositories.mockResolvedValue({
      repositories: [
        {
          name: "hello-world",
          isPrivate: false,
          url: "https://github.com/octocat/hello-world",
          alreadyConnected: false,
          isEnabled: null,
        },
      ],
      hasMore: false,
      resolvedOwnerType: "user",
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Add sources/i }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: /Add sources/i })[0]);

    // Scope queries to the dialog so GitHub-related controls on the page behind
    // the portal don't collide with the modal's own.
    const dialog = within(await screen.findByRole("dialog"));

    await user.click(await dialog.findByRole("button", { name: /github/i }));

    await user.type(await dialog.findByLabelText("Organization, user, or URL"), "octocat");
    await user.click(dialog.getByRole("button", { name: "Discover" }));

    const repoRow = (await dialog.findByText("hello-world")).closest("label") as HTMLElement;
    await user.click(within(repoRow).getByRole("checkbox"));
    await user.click(dialog.getByRole("button", { name: /add to list/i }));

    // Back on the list; the staged repo connects together with the others.
    await user.click(await dialog.findByRole("button", { name: /connect 1 source/i }));

    await waitFor(() => {
      expect(mockConnectGithubRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: "octocat",
          name: "hello-world",
          tokenName: "token1",
          projectId: "proj1",
        }),
      );
    });
  });

  it("warns instead of connecting when the user only has member access to the project", async () => {
    selectProject({ isManaged: false });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Add sources/i }).length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByRole("button", { name: /Add sources/i })[0]);
    const dialog = within(await screen.findByRole("dialog"));

    // The modal states the reason up front on the type grid; drilling into a
    // detail screen keeps "Connect now" disabled rather than accepting a connect
    // that fails.
    expect(
      await dialog.findByText(/only connect sources to projects you manage/i),
    ).toBeInTheDocument();

    await user.click(await dialog.findByRole("button", { name: /github/i }));
    expect(dialog.getByRole("button", { name: /connect now/i })).toBeDisabled();

    expect(mockConnectGithubRepository).not.toHaveBeenCalled();
  });
});
