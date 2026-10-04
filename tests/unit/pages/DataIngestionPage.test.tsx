import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
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

/** The "latest runs" request behind the source cards: the project's newest runs, no filter. */
type RunsFilter = { size?: number; status?: string };
const isLatestRunsRequest = (filter: RunsFilter) =>
  filter.size === 50 && filter.status === undefined;

function githubConfig(overrides = {}) {
  return {
    id: "cfg-1",
    repositoryOwner: "octocat",
    repositoryName: "hello-world",
    autoUpdate: true,
    spec: { type: "INTERVAL", everyMinutes: 60 },
    schedule: "every 60m",
    nextSyncAt: null,
    ...overrides,
  };
}

function jiraConfig(overrides = {}) {
  return {
    instanceUrl: "https://team.atlassian.net",
    autoUpdate: true,
    spec: { type: "INTERVAL", everyMinutes: 60 },
    schedule: "every 60m",
    nextSyncAt: null,
    ...overrides,
  };
}

function githubStatusRow(name: string, repositoryId: string, overrides = {}) {
  return {
    sourceSystem: "GITHUB",
    sourceId: `octocat/${name}`,
    displayName: `octocat/${name}`,
    repositoryId,
    owner: "octocat",
    name,
    sourceUrl: `https://github.com/octocat/${name}`,
    connectionStatus: "CONNECTED",
    enabled: true,
    lastRunTime: "2026-07-01T00:00:00Z",
    ingestedCount: 5,
    updatedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    failedItems: [],
    artifactCount: 10,
    lastCommitsSyncAt: null,
    lastIssuesSyncAt: null,
    lastPullRequestsSyncAt: null,
    ...overrides,
  };
}

function githubRun(runId: string, repositoryId: string, name: string, overrides = {}) {
  return {
    runId,
    sourceSystem: "GITHUB",
    sourceId: `octocat/${name}`,
    owner: "octocat",
    name,
    repositoryId,
    startedAt: "2026-07-05T10:00:00Z",
    finishedAt: null,
    ingestedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    failedCount: 0,
    status: "RUNNING",
    failedItems: [],
    failureReason: null,
    aiSyncStatus: "NOT_APPLICABLE",
    aiSyncFailureReason: null,
    ...overrides,
  };
}

const {
  mockGetIngestionRunsPage,
  mockGetIngestionStatus,
  mockConnectGithubRepository,
  mockDiscoverRepositories,
  mockGetGithubPatNames,
  mockUpdateGithubRepository,
  mockGetAccessibleProject,
  mockGetIngestionSourceStatuses,
  mockListConnectors,
  mockGetGithubRepositoryConfig,
  mockConfigureGithubRepository,
  mockRemoveRepositoryFromProject,
} = vi.hoisted(() => ({
  mockGetIngestionRunsPage: vi.fn(),
  mockGetIngestionStatus: vi.fn(),
  mockConnectGithubRepository: vi.fn(),
  mockDiscoverRepositories: vi.fn(),
  mockGetGithubPatNames: vi.fn(),
  mockUpdateGithubRepository: vi.fn(),
  mockGetAccessibleProject: vi.fn(),
  mockGetIngestionSourceStatuses: vi.fn(),
  mockListConnectors: vi.fn(),
  mockGetGithubRepositoryConfig: vi.fn(),
  mockConfigureGithubRepository: vi.fn(),
  mockRemoveRepositoryFromProject: vi.fn(),
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
  updateGithubRepository: mockUpdateGithubRepository,
  getGithubRepositoryConfig: mockGetGithubRepositoryConfig,
  configureGithubRepository: mockConfigureGithubRepository,
  removeRepositoryFromProject: mockRemoveRepositoryFromProject,
}));

const {
  mockGetJiraInstances,
  mockUpdateJiraInstance,
  mockGetJiraConfig,
  mockConfigureJiraInstance,
} = vi.hoisted(() => ({
  mockGetJiraInstances: vi.fn(),
  mockUpdateJiraInstance: vi.fn(),
  mockGetJiraConfig: vi.fn(),
  mockConfigureJiraInstance: vi.fn(),
}));

vi.mock("../../../src/services/sources/jiraService", () => ({
  getJiraInstances: mockGetJiraInstances,
  updateJiraInstance: mockUpdateJiraInstance,
  getJiraConfig: mockGetJiraConfig,
  configureJiraInstance: mockConfigureJiraInstance,
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
    knowledgeService: { ...actual.knowledgeService },
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
    mockGetGithubRepositoryConfig.mockResolvedValue(githubConfig());
    mockConfigureGithubRepository.mockResolvedValue(undefined);
    mockRemoveRepositoryFromProject.mockResolvedValue({
      repositoryId: "repo-uuid",
      projectIds: [],
    });
    mockGetJiraConfig.mockResolvedValue(jiraConfig());
    mockConfigureJiraInstance.mockResolvedValue(undefined);
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

  it("starts an update from the drawer and reloads the project's sources", async () => {
    mockGetIngestionSourceStatuses.mockResolvedValue([githubStatusRow("hello-world", "repo-uuid")]);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/data-ingestion?sourceId=octocat/hello-world"]}>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    const panel = await screen.findByRole("dialog");
    const callsBefore = mockGetIngestionSourceStatuses.mock.calls.length;
    await user.click(within(panel).getByRole("button", { name: /Update repo/ }));

    await waitFor(() => {
      expect(mockUpdateGithubRepository).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "octocat", name: "hello-world" }),
      );
    });
    await waitFor(() => {
      expect(mockGetIngestionSourceStatuses.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("closes the drawer once the source was removed from the project", async () => {
    mockGetIngestionSourceStatuses.mockResolvedValue([githubStatusRow("hello-world", "repo-uuid")]);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/data-ingestion?sourceId=octocat/hello-world"]}>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    const panel = await screen.findByRole("dialog");
    // After the removal the project has no sources left.
    mockGetIngestionSourceStatuses.mockResolvedValue([]);
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [],
      users: [],
    });

    await user.click(within(panel).getByRole("button", { name: /Remove from project/ }));
    await user.click(await screen.findByRole("button", { name: /^Remove$/ }));

    await waitFor(() => {
      expect(mockRemoveRepositoryFromProject).toHaveBeenCalledWith("repo-uuid", "proj1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
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

  it("shows the loading state, not the old error, while the connectors modal retries a failed load", async () => {
    mockListConnectors.mockRejectedValueOnce(new Error("Forbidden"));
    let rejectRetry: (error: Error) => void = () => {};
    mockListConnectors.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRetry = reject;
      }),
    );
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    await screen.findAllByText("octocat/hello-world");
    await waitFor(() => expect(mockListConnectors).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /manage connectors/i }));

    const modal = within(await screen.findByRole("dialog", { name: "Connectors" }));
    expect(await modal.findByText("Loading connectors")).toBeInTheDocument();
    expect(modal.queryByText("Forbidden")).not.toBeInTheDocument();
    expect(modal.queryByText("No connectors registered")).not.toBeInTheDocument();

    rejectRetry(new Error("Still forbidden"));

    expect(await modal.findByText("Still forbidden")).toBeInTheDocument();
    expect(modal.queryByText("Loading connectors")).not.toBeInTheDocument();
  });

  it("shows one banner per failed load even when the failures read the same", async () => {
    mockGetIngestionRunsPage.mockRejectedValue(new Error("Network down"));
    mockGetIngestionSourceStatuses.mockRejectedValue(new Error("Network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await waitFor(() => expect(screen.getAllByText("Network down")).toHaveLength(2));
      // Banners keyed by their message would collide here.
      expect(consoleError.mock.calls.some((call) => String(call[0]).includes("same key"))).toBe(
        false,
      );
    } finally {
      consoleError.mockRestore();
    }
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
    const tableResponses = [
      () => Promise.resolve(createRunPage([run("old-run")])),
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      () => Promise.resolve(createRunPage([run("new-run")])),
    ];
    mockGetIngestionRunsPage.mockImplementation((filter: RunsFilter) => {
      // The cards' own latest-runs request is not part of the scripted table responses.
      if (isLatestRunsRequest(filter)) return Promise.resolve(createRunPage());

      return (
        tableResponses.shift() ??
        tableResponses[0] ??
        (() => Promise.resolve(createRunPage()))
      )();
    });

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

    await user.click(
      await screen.findByRole("switch", { name: /toggle jira auto update for this project/i }),
    );
    await user.click(screen.getByRole("button", { name: /apply to project/i }));

    await waitFor(() => {
      expect(mockConfigureJiraInstance).toHaveBeenCalledWith({
        instanceUrl: "https://team.atlassian.net",
        autoUpdate: false,
        schedule: { type: "INTERVAL", everyMinutes: 60 },
      });
    });
  });

  it("applies the global sync schedule to every Confluence connection", async () => {
    mockGetAccessibleProject.mockResolvedValue({
      id: "proj1",
      name: "Project Alpha",
      description: "",
      manager: null,
      sources: [],
      users: [],
    });

    const scheduleRequests: unknown[] = [];
    server.use(
      http.get("/api/v1/confluence/projects/:projectId/connections", () =>
        HttpResponse.json([
          {
            id: "conn-1",
            projectId: "proj1",
            baseUrl: "https://acme.atlassian.net",
            spaceId: "123456",
            spaceKey: "ENG",
            spaceName: "Engineering",
            credentialName: "default",
            pageAllowlist: [],
            pageDenylist: [],
            credentialsConfigured: true,
            createdAt: "2026-07-01T00:00:00Z",
            updatedAt: "2026-07-01T00:00:00Z",
            version: 1,
            sourceEnabled: true,
            autoUpdate: true,
            spec: { type: "INTERVAL", everyMinutes: 60 },
            schedule: "every 60m",
            nextSyncAt: null,
          },
        ]),
      ),
      http.get("/api/v1/confluence/projects/:projectId/connections/:connectionId", () =>
        HttpResponse.json({
          id: "conn-1",
          projectId: "proj1",
          baseUrl: "https://acme.atlassian.net",
          spaceId: "123456",
          spaceKey: "ENG",
          spaceName: "Engineering",
          credentialName: "default",
          pageAllowlist: [],
          pageDenylist: [],
          credentialsConfigured: true,
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
          version: 1,
          sourceEnabled: true,
          autoUpdate: true,
          spec: { type: "INTERVAL", everyMinutes: 60 },
          schedule: "every 60m",
          nextSyncAt: null,
        }),
      ),
      http.put(
        "/api/v1/confluence/projects/:projectId/connections/:connectionId/schedule",
        async ({ request, params }) => {
          scheduleRequests.push({ connectionId: params.connectionId, body: await request.json() });
          return HttpResponse.json({});
        },
      ),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DataIngestionPage />
      </MemoryRouter>,
    );

    const manageButton = await screen.findByRole("button", { name: /manage sync settings/i });
    await user.click(manageButton);

    expect(await screen.findByText("Confluence Sync Settings")).toBeInTheDocument();

    await user.click(
      await screen.findByRole("switch", {
        name: /toggle confluence auto update for this project/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /apply to project/i }));

    await waitFor(() => {
      expect(scheduleRequests).toEqual([
        {
          connectionId: "conn-1",
          body: { autoUpdate: false, schedule: { type: "INTERVAL", everyMinutes: 60 } },
        },
      ]);
    });
  });

  describe("source cards", () => {
    const statusRows = () => [githubStatusRow("hello-world", "repo-uuid")];

    beforeEach(() => {
      mockGetAccessibleProject.mockResolvedValue({
        id: "proj1",
        name: "Project Alpha",
        description: "",
        manager: null,
        sources: [{ id: "src1", name: "octocat/hello-world", type: "GITHUB", status: "CONNECTED" }],
        users: [],
      });
      mockGetIngestionSourceStatuses.mockResolvedValue(statusRows());
    });

    const sourcesSection = () => within(screen.getByRole("region", { name: "Sources" }));

    it("keeps a card's status when the run table is filtered", async () => {
      // The newest run of the repository is still running; the table filter below
      // asks for failed runs only, which returns none.
      mockGetIngestionRunsPage.mockImplementation((filter: RunsFilter) =>
        Promise.resolve(
          isLatestRunsRequest(filter) || filter.status === undefined
            ? createRunPage([githubRun("run-live", "repo-uuid", "hello-world")])
            : createRunPage(),
        ),
      );

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(sourcesSection().getAllByText("Syncing").length).toBeGreaterThan(0);
      });

      await user.click(screen.getByRole("combobox", { name: "Filter runs by status" }));
      await user.click(await screen.findByRole("option", { name: "Failed" }));

      await waitFor(() => {
        expect(mockGetIngestionRunsPage).toHaveBeenLastCalledWith(
          expect.objectContaining({ status: "FAILED" }),
        );
      });
      expect(screen.queryByText("run-live")).not.toBeInTheDocument();
      expect(sourcesSection().getAllByText("Syncing").length).toBeGreaterThan(0);
    });

    it("refreshes the card while a run is in flight until it has finished", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // First answer: the repository is syncing. Every later answer: it has finished.
        mockGetIngestionSourceStatuses
          .mockResolvedValueOnce([
            githubStatusRow("hello-world", "repo-uuid", { connectionStatus: "UPDATING" }),
          ])
          .mockResolvedValue(statusRows());
        mockGetIngestionRunsPage
          .mockResolvedValueOnce(createRunPage([githubRun("run-live", "repo-uuid", "hello-world")]))
          .mockResolvedValueOnce(createRunPage([githubRun("run-live", "repo-uuid", "hello-world")]))
          .mockResolvedValue(
            createRunPage([
              githubRun("run-live", "repo-uuid", "hello-world", {
                status: "COMPLETED",
                finishedAt: "2026-07-05T10:05:00Z",
                aiSyncStatus: "SUCCEEDED",
              }),
            ]),
          );

        render(
          <MemoryRouter>
            <DataIngestionPage />
          </MemoryRouter>,
        );

        await waitFor(() => {
          expect(sourcesSection().getAllByText("Syncing").length).toBeGreaterThan(0);
        });
        // The reload is armed by the runs that are in flight, and the cards do not wait for
        // them, so let the run table load before the clock moves.
        expect(await screen.findByText("run-live")).toBeInTheDocument();

        // One poll tick reloads the statuses and the latest runs, not only the table.
        await vi.advanceTimersByTimeAsync(3100);

        await waitFor(() => {
          expect(sourcesSection().queryByText("Syncing")).not.toBeInTheDocument();
        });
        expect(sourcesSection().getAllByText("Synced").length).toBeGreaterThan(0);
        expect(mockGetIngestionSourceStatuses.mock.calls.length).toBeGreaterThan(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("project-wide sync settings", () => {
    const twoRepositories = () => {
      mockGetAccessibleProject.mockResolvedValue({
        id: "proj1",
        name: "Project Alpha",
        description: "",
        manager: null,
        sources: [
          { id: "src1", name: "octocat/one", type: "GITHUB", status: "CONNECTED" },
          { id: "src2", name: "octocat/two", type: "GITHUB", status: "CONNECTED" },
        ],
        users: [],
      });
      mockGetIngestionSourceStatuses.mockResolvedValue([
        githubStatusRow("one", "repo-one"),
        githubStatusRow("two", "repo-two"),
      ]);
    };

    const openSyncSettings = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByRole("button", { name: /manage sync settings/i }));
      expect(await screen.findByText("GitHub Sync Settings")).toBeInTheDocument();
    };

    it("applies the schedule to each repository of the project, not platform-wide", async () => {
      twoRepositories();

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await openSyncSettings(user);
      await user.click(
        await screen.findByRole("switch", { name: /toggle github auto update for this project/i }),
      );
      await user.click(screen.getByRole("button", { name: /apply to project/i }));

      await waitFor(() => {
        expect(mockConfigureGithubRepository).toHaveBeenCalledTimes(2);
      });
      const request = { autoUpdate: false, schedule: { type: "INTERVAL", everyMinutes: 60 } };
      expect(mockConfigureGithubRepository).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "octocat", name: "one" }),
        request,
      );
      expect(mockConfigureGithubRepository).toHaveBeenCalledWith(
        expect.objectContaining({ owner: "octocat", name: "two" }),
        request,
      );
    });

    it("pre-fills the schedule the repositories already share", async () => {
      twoRepositories();
      mockGetGithubRepositoryConfig.mockResolvedValue(
        githubConfig({ autoUpdate: true, spec: { type: "INTERVAL", everyMinutes: 15 } }),
      );

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await openSyncSettings(user);

      expect(await screen.findByRole("spinbutton", { name: /minutes/i })).toHaveValue(15);
      expect(screen.queryByText(/different schedules/i)).not.toBeInTheDocument();
    });

    it("shows the default and a hint when the repositories have different schedules", async () => {
      twoRepositories();
      mockGetGithubRepositoryConfig
        .mockResolvedValueOnce(githubConfig({ spec: { type: "INTERVAL", everyMinutes: 15 } }))
        .mockResolvedValueOnce(githubConfig({ spec: { type: "INTERVAL", everyMinutes: 30 } }));

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await openSyncSettings(user);

      expect(await screen.findByText(/different schedules/i)).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: /minutes/i })).toHaveValue(60);
    });

    it("still applies the schedule to the other repositories when one save fails", async () => {
      twoRepositories();
      mockConfigureGithubRepository
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <DataIngestionPage />
        </MemoryRouter>,
      );

      await openSyncSettings(user);
      await user.click(
        await screen.findByRole("switch", { name: /toggle github auto update for this project/i }),
      );
      await user.click(screen.getByRole("button", { name: /apply to project/i }));

      await waitFor(() => {
        expect(mockConfigureGithubRepository).toHaveBeenCalledTimes(2);
      });
    });
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
