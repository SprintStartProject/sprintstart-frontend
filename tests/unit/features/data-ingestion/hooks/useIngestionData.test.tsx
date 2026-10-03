import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "../../../setup/rtl";
import { useIngestionData } from "../../../../../src/features/data-ingestion/hooks/useIngestionData";

const {
  mockGetRunsPage,
  mockGetStatuses,
  mockGetAccessibleProject,
  mockGetJira,
  mockListConfluence,
} = vi.hoisted(() => ({
  mockGetRunsPage: vi.fn(),
  mockGetStatuses: vi.fn(),
  mockGetAccessibleProject: vi.fn(),
  mockGetJira: vi.fn(),
  mockListConfluence: vi.fn(),
}));

vi.mock("../../../../../src/services/ingestionService", () => ({
  getIngestionRunsPage: mockGetRunsPage,
  getIngestionSourceStatuses: mockGetStatuses,
}));

vi.mock("../../../../../src/services/projectService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../../src/services/projectService")>();
  return {
    ...actual,
    projectService: { ...actual.projectService, getAccessibleProject: mockGetAccessibleProject },
  };
});

vi.mock("../../../../../src/services/sources/jiraService", () => ({
  getJiraInstances: mockGetJira,
}));

vi.mock("../../../../../src/services/sources/confluenceService", () => ({
  confluenceService: { listConnections: mockListConfluence },
}));

const run = (runId: string, status: string) => ({
  runId,
  sourceSystem: "GITHUB",
  status,
  startedAt: "2026-07-05T10:00:00Z",
});

const runsPage = (items: unknown[]) => ({
  items,
  page: { number: 1, size: 10, totalElements: items.length, totalPages: 1, hasNext: false },
});

const runQuery = { page: 1, size: 10, projectId: "proj1" };

describe("useIngestionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRunsPage.mockResolvedValue(runsPage([]));
    mockGetStatuses.mockResolvedValue([]);
    mockGetAccessibleProject.mockResolvedValue({
      sources: [{ id: "src1", name: "octocat/api", type: "GITHUB", status: "CONNECTED" }],
    });
    mockGetJira.mockResolvedValue([]);
    mockListConfluence.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the cards' data for the selected project", async () => {
    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: false }),
    );

    await waitFor(() => expect(result.current.projectSources).toHaveLength(1));

    expect(mockGetStatuses).toHaveBeenCalledWith("proj1");
    expect(mockGetAccessibleProject).toHaveBeenCalledWith("proj1");
    expect(mockGetJira).toHaveBeenCalledWith("proj1");
    expect(mockListConfluence).toHaveBeenCalledWith("proj1");
    // The newest runs behind the cards are asked for apart from the table's page.
    expect(mockGetRunsPage).toHaveBeenCalledWith({ projectId: "proj1", size: 50 });
    expect(mockGetRunsPage).toHaveBeenCalledWith(runQuery);
  });

  it("holds the project-scoped loads back until a project is selected", async () => {
    const { result } = renderHook(() =>
      useIngestionData({
        projectId: null,
        runQuery: { page: 1, size: 10 },
        isPollingWindowOpen: false,
      }),
    );

    await waitFor(() => expect(result.current.isRunsLoading).toBe(false));

    expect(result.current.isProjectDataLoading).toBe(false);
    expect(mockGetStatuses).not.toHaveBeenCalled();
    expect(mockGetAccessibleProject).not.toHaveBeenCalled();
    expect(mockGetJira).not.toHaveBeenCalled();
  });

  it("reports a failed status or project source load but keeps Jira and Confluence quiet", async () => {
    mockGetStatuses.mockRejectedValue(new Error("status down"));
    mockGetAccessibleProject.mockRejectedValue(new Error("project down"));
    mockGetJira.mockRejectedValue(new Error("forbidden"));
    mockListConfluence.mockRejectedValue(new Error("forbidden"));

    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: false }),
    );

    await waitFor(() => expect(result.current.statusErrorMessage).toBe("status down"));

    expect(result.current.projectSourcesErrorMessage).toBe("project down");
    expect(result.current.jiraInstances).toEqual([]);
    expect(result.current.confluenceConnections).toEqual([]);
    expect(result.current.runsErrorMessage).toBeNull();
  });

  it("reloads the status rows and the latest runs while a run is in flight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetRunsPage.mockResolvedValue(runsPage([run("run-1", "RUNNING")]));

    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: false }),
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(1));
    const statusCalls = mockGetStatuses.mock.calls.length;
    const runCalls = mockGetRunsPage.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3100);

    expect(mockGetStatuses.mock.calls.length).toBeGreaterThan(statusCalls);
    expect(mockGetRunsPage.mock.calls.length).toBeGreaterThan(runCalls);
  });

  it("brings the status rows level once the last run has finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The runs say it is over on the first poll; the status rows answer "still syncing"
    // until they are asked once more.
    mockGetRunsPage
      .mockResolvedValueOnce(runsPage([run("run-1", "RUNNING")]))
      .mockResolvedValueOnce(runsPage([run("run-1", "RUNNING")]))
      .mockResolvedValue(runsPage([run("run-1", "COMPLETED")]));
    mockGetStatuses.mockResolvedValue([{ sourceId: "octocat/api", connectionStatus: "UPDATING" }]);

    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: false }),
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(1));
    mockGetStatuses.mockResolvedValue([{ sourceId: "octocat/api", connectionStatus: "CONNECTED" }]);

    await vi.advanceTimersByTimeAsync(3100);

    await waitFor(() =>
      expect(result.current.statuses).toEqual([
        { sourceId: "octocat/api", connectionStatus: "CONNECTED" },
      ]),
    );
  });

  it("does not reload on its own while nothing runs and no window is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetRunsPage.mockResolvedValue(runsPage([run("run-1", "COMPLETED")]));

    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: false }),
    );

    await waitFor(() => expect(result.current.runs).toHaveLength(1));
    const statusCalls = mockGetStatuses.mock.calls.length;

    await vi.advanceTimersByTimeAsync(10_000);

    expect(mockGetStatuses).toHaveBeenCalledTimes(statusCalls);
  });

  it("reloads while the post-update window is open even though no run is listed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() =>
      useIngestionData({ projectId: "proj1", runQuery, isPollingWindowOpen: true }),
    );

    await waitFor(() => expect(result.current.projectSources).toHaveLength(1));
    const statusCalls = mockGetStatuses.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3100);

    expect(mockGetStatuses.mock.calls.length).toBeGreaterThan(statusCalls);
  });
});
