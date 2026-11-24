import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataIngestionPage } from "../../../src/pages/DataIngestionPage";
import { ToastProvider } from "../../../src/context/ToastProvider";
import { createProjectContextValue, createSelectableProject } from "../setup/projectContext";

const mocks = vi.hoisted(() => ({
  permissionGroup: "PM",
  project: null as Record<string, unknown> | null,
  setSelectedProjectId: vi.fn(),
  reloadProjects: vi.fn(),
  ingestion: {},
  runQueries: [] as unknown[],
  sources: [] as unknown[],
  listConnectors: vi.fn(),
  setConnectorEnabled: vi.fn(),
  loadSchedule: vi.fn(),
  saveSchedule: vi.fn(),
  getPatNames: vi.fn(),
}));

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mocks.project,
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: { id: "u", permissionGroup: mocks.permissionGroup } }),
}));

vi.mock("../../../src/features/data-ingestion/hooks/useIngestionData.ts", () => ({
  useIngestionData: (options: { runQuery: unknown; isPollingWindowOpen: boolean }) => {
    mocks.runQueries.push({ query: options.runQuery, polling: options.isPollingWindowOpen });
    return mocks.ingestion;
  },
}));

vi.mock("../../../src/features/data-ingestion/buildSources.ts", () => ({
  buildDataSources: () => mocks.sources,
}));

vi.mock("../../../src/features/connectors/data.ts", () => ({
  toConnectorListItems: (items: unknown) => items,
}));

vi.mock("../../../src/services/connectorService.ts", () => ({
  connectorService: {
    listConnectors: mocks.listConnectors,
    setConnectorEnabled: mocks.setConnectorEnabled,
  },
}));

vi.mock("../../../src/services/sources/githubService.ts", () => ({
  getGithubPatNames: mocks.getPatNames,
}));

vi.mock("../../../src/features/data-ingestion/projectSyncSchedule.ts", () => ({
  loadProjectSyncSchedule: mocks.loadSchedule,
  saveProjectSyncSchedule: mocks.saveSchedule,
}));

vi.mock("../../../src/features/data-ingestion/components/DataIngestionHeader.tsx", () => ({
  DataIngestionHeader: (props: {
    isLoading: boolean;
    onAddSource: () => void;
    onRefresh: () => void;
  }) => (
    <div>
      <p>header loading: {String(props.isLoading)}</p>
      <button onClick={props.onAddSource}>Add a source</button>
      <button onClick={props.onRefresh}>Refresh now</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/DataIngestionSectionFilter.tsx", () => ({
  DataIngestionSectionFilter: (props: {
    active: string;
    sourceCount: number;
    runCount: number;
    onChange: (section: string) => void;
  }) => (
    <div>
      <p>
        section: {props.active} sources={props.sourceCount} runs={props.runCount}
      </p>
      <button onClick={() => props.onChange("overview")}>Go overview</button>
      <button onClick={() => props.onChange("sources")}>Go sources</button>
      <button onClick={() => props.onChange("runs")}>Go runs</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/DataIngestionLoadingState.tsx", () => ({
  DataIngestionLoadingState: () => <p>initial loading</p>,
}));

vi.mock("../../../src/features/data-ingestion/components/OverviewSection.tsx", () => ({
  OverviewSection: (props: {
    sources: unknown[];
    totalArtifactCount: number;
    runs: unknown[];
    onNavigate: (section: string) => void;
  }) => (
    <div>
      <p>
        overview sources={props.sources.length} artifacts={props.totalArtifactCount} runs=
        {props.runs.length}
      </p>
      <button onClick={() => props.onNavigate("runs")}>Overview to runs</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/SourceList.tsx", () => ({
  SourceList: (props: {
    sources: { sourceId: string; name: string }[];
    selectedSourceId: string | null;
    onSelectSource: (id: string | null) => void;
    onAddSource: () => void;
  }) => (
    <div data-testid="source-list">
      <p>selected: {props.selectedSourceId ?? "none"}</p>
      {props.sources.map((source) => (
        <button key={source.sourceId} onClick={() => props.onSelectSource(source.sourceId)}>
          Pick {source.name}
        </button>
      ))}
      <button onClick={props.onAddSource}>Empty add</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/RunHistory.tsx", () => ({
  RunHistory: (props: {
    runs: { runId: string }[];
    selectedRunId: string | null;
    isFiltered: boolean;
    sourceLabelBySourceRef: Record<string, string> | Map<string, string>;
    onSelectRun: (run: unknown) => void;
  }) => (
    <div data-testid="run-history">
      <p>
        selected run: {props.selectedRunId ?? "none"} filtered: {String(props.isFiltered)}
      </p>
      {props.runs.map((run) => (
        <button key={run.runId} onClick={() => props.onSelectRun(run)}>
          Run {run.runId}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/RunHistoryFilters.tsx", () => ({
  RunHistoryFilters: (props: {
    status: string;
    sourceValue: string;
    sources: { value: string; label: string }[];
    disabled: boolean;
    onStatusChange: (status: string) => void;
    onSourceChange: (value: string) => void;
    onReset: () => void;
  }) => (
    <div>
      <p>
        filters: {props.status} {props.sourceValue} options=
        {props.sources.map((s) => s.label).join(",")} disabled={String(props.disabled)}
      </p>
      <button onClick={() => props.onStatusChange("FAILED")}>Only failed</button>
      <button onClick={() => props.onSourceChange("https://team.atlassian.net")}>Only jira</button>
      <button onClick={() => props.onSourceChange("unknown-value")}>Only unknown</button>
      <button onClick={props.onReset}>Reset filters</button>
    </div>
  ),
}));

vi.mock("../../../src/components/ui/Pagination.tsx", () => ({
  Pagination: (props: {
    currentPage: number;
    totalPages: number;
    onPageChange: (p: number) => void;
  }) => (
    <div>
      <p>
        page {props.currentPage} of {props.totalPages}
      </p>
      <button onClick={() => props.onPageChange(props.currentPage + 1)}>Next runs page</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/SourceDetailsPanel.tsx", () => ({
  SourceDetailsPanel: (props: {
    source: { name: string };
    projectId: string | null;
    canManage: boolean;
    canUnlink: boolean;
    onChanged: (change: string) => Promise<void>;
    onClose: () => void;
  }) => (
    <div data-testid="source-panel">
      <p>
        source panel: {props.source.name} project={String(props.projectId)} manage=
        {String(props.canManage)} unlink={String(props.canUnlink)}
      </p>
      <button onClick={() => void props.onChanged("updated")}>Panel updated</button>
      <button onClick={() => void props.onChanged("changed")}>Panel changed</button>
      <button onClick={() => void props.onChanged("unlinked")}>Panel unlinked</button>
      <button onClick={props.onClose}>Close source panel</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/RunDetailsPanel.tsx", () => ({
  RunDetailsPanel: (props: {
    run: { runId: string };
    sourceLabel: string;
    onClose: () => void;
  }) => (
    <div data-testid="run-panel">
      <p>
        run panel: {props.run.runId} label={props.sourceLabel}
      </p>
      <button onClick={props.onClose}>Close run panel</button>
    </div>
  ),
}));

vi.mock("../../../src/features/connectors/components/ConnectorList.tsx", () => ({
  ConnectorList: (props: {
    connectors: { id: string; enabled: boolean }[];
    togglingConnectorId: string | null;
    projectId: string;
    onToggleEnabled: (connector: { id: string; enabled: boolean }) => void;
    onSourcesSaved: () => void;
  }) => (
    <div data-testid="connector-list">
      <p>
        toggling: {props.togglingConnectorId ?? "none"} project={props.projectId}
      </p>
      {props.connectors.map((connector) => (
        <button key={connector.id} onClick={() => props.onToggleEnabled(connector)}>
          Toggle {connector.id} ({String(connector.enabled)})
        </button>
      ))}
      <button onClick={props.onSourcesSaved}>Sources saved</button>
    </div>
  ),
}));

vi.mock("../../../src/features/connectors/components/ConnectorsLoadingState.tsx", () => ({
  ConnectorsLoadingState: () => <p>connectors loading</p>,
}));

vi.mock("../../../src/features/data-ingestion/components/AddSourceModal.tsx", () => ({
  AddSourceModal: (props: {
    projectId: string;
    projectName?: string;
    tokenNames: string[];
    canIngest: boolean;
    canAssignOwners: boolean;
    ingestBlockedReason?: string;
    onClose: () => void;
    onConnected: () => void;
  }) => (
    <div data-testid="add-source">
      <p>
        add source: project={props.projectId} name={String(props.projectName)} tokens=
        {props.tokenNames.join(",")} ingest={String(props.canIngest)} owners=
        {String(props.canAssignOwners)}
      </p>
      <p>blocked: {props.ingestBlockedReason ?? "no"}</p>
      <button onClick={props.onConnected}>Connected a source</button>
      <button onClick={props.onClose}>Close add source</button>
    </div>
  ),
}));

vi.mock("../../../src/features/data-ingestion/components/SyncScheduleSettings.tsx", () => ({
  SyncScheduleSettings: (props: {
    loadKey: string;
    loadConfig: () => Promise<unknown>;
    onSave: (request: unknown) => Promise<void>;
    disclaimer: string;
    autoUpdateOnText: string;
    autoUpdateOffText: string;
    toggleAriaLabel: string;
    saveLabel: string;
  }) => (
    <div data-testid="sync-settings">
      <p>sync system: {props.loadKey}</p>
      <p>{props.disclaimer}</p>
      <p>{props.autoUpdateOnText}</p>
      <p>{props.autoUpdateOffText}</p>
      <p>{props.toggleAriaLabel}</p>
      <button onClick={() => void props.loadConfig()}>Load schedule</button>
      <button onClick={() => void props.onSave({ autoUpdate: true })}>{props.saveLabel}</button>
    </div>
  ),
}));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function source(sourceId: string, system: string, state = "connected", details?: unknown) {
  return {
    sourceId,
    sourceSystem: system,
    name: `Src ${sourceId}`,
    statusView: { state },
    details: details ?? { system },
  };
}

function setProject(overrides = {}) {
  const project = createSelectableProject({
    id: "proj1",
    name: "Alpha",
    isManaged: true,
    ...overrides,
  });
  mocks.project = {
    ...createProjectContextValue({
      projects: [project],
      selectedProject: project,
      selectedProjectId: "proj1",
    }),
    setSelectedProjectId: mocks.setSelectedProjectId,
    reloadProjects: mocks.reloadProjects,
  };
}

function renderPage(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/data-ingestion${search}`]}>
      <DataIngestionPage />
      <Where />
    </MemoryRouter>,
    { wrapper: ToastProvider },
  );
}

const run = (runId: string) => ({ runId, sourceSystem: "GITHUB", sourceId: "src-1" });

const jira = source("https://team.atlassian.net", "JIRA", "syncing");
const github = source("src-1", "GITHUB", "connected", {
  system: "GITHUB",
  repository: { fullName: "Octo/Hello", repositoryId: "repo-uuid" },
});
const broken = source("src-2", "GITHUB", "attention", {
  system: "GITHUB",
  repository: { fullName: "Octo/Broken", repositoryId: "repo-2" },
});

describe("DataIngestionPage flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissionGroup = "PM";
    mocks.runQueries = [];
    setProject();
    mocks.sources = [github, jira, broken];
    mocks.ingestion = {
      statuses: [{ artifactCount: 10 }, { artifactCount: 5 }],
      latestRuns: [{ runId: "l1" }],
      runs: [run("r1"), run("r2")],
      runPageMeta: { totalElements: 25, totalPages: 3 },
      isRunsPlaceholder: false,
      isRunsLoading: false,
      isProjectDataLoading: false,
      runsErrorMessage: null,
      statusErrorMessage: null,
      projectSourcesErrorMessage: null,
    };
    mocks.listConnectors.mockResolvedValue([
      { id: "github", enabled: true },
      { id: "jira", enabled: false },
    ]);
    mocks.setConnectorEnabled.mockImplementation((id: string, enabled: boolean) =>
      Promise.resolve({ id, enabled }),
    );
    mocks.loadSchedule.mockResolvedValue({
      config: { autoUpdate: true, schedule: "every 60m" },
      isMixed: true,
    });
    mocks.saveSchedule.mockResolvedValue(undefined);
    mocks.getPatNames.mockResolvedValue(["token-a"]);
    mocks.reloadProjects.mockResolvedValue(undefined);
  });

  describe("the overview", () => {
    it("starts on the overview with the sources, the artifacts and the latest runs", async () => {
      renderPage();

      expect(await screen.findByText("section: overview sources=3 runs=25")).toBeInTheDocument();
      expect(screen.getByText("overview sources=3 artifacts=15 runs=1")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Sources" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Runs" })).toBeInTheDocument();
    });

    it("counts the runs on the page when there is no page information", async () => {
      mocks.ingestion = { ...mocks.ingestion, runPageMeta: undefined };
      renderPage();

      expect(await screen.findByText(/runs=2$/)).toBeInTheDocument();
      expect(screen.queryByText(/total$/)).not.toBeInTheDocument();
    });

    it("moves to a section from the overview and from the section filter", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Overview to runs" }));
      expect(screen.getByText(/section: runs/)).toBeInTheDocument();
      expect(screen.queryByText(/^overview sources/)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Sources" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Go sources" }));
      expect(screen.getByRole("region", { name: "Sources" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Runs" })).not.toBeInTheDocument();
    });
  });

  describe("loading and errors", () => {
    it("shows the loading state while there are no sources yet", async () => {
      mocks.sources = [];
      mocks.ingestion = { ...mocks.ingestion, isRunsLoading: true };
      renderPage();

      expect(await screen.findByText("initial loading")).toBeInTheDocument();
      expect(screen.getByText("header loading: true")).toBeInTheDocument();
    });

    it("waits for the project data on the sources section only", async () => {
      mocks.sources = [];
      mocks.ingestion = { ...mocks.ingestion, isProjectDataLoading: true };
      const user = userEvent.setup();
      renderPage();
      expect(await screen.findByText("initial loading")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Go runs" }));

      expect(screen.queryByText("initial loading")).not.toBeInTheDocument();
    });

    it("keeps showing the sources while they reload", async () => {
      mocks.ingestion = { ...mocks.ingestion, isRunsLoading: true };
      renderPage();

      expect(await screen.findByTestId("source-list")).toBeInTheDocument();
      expect(screen.queryByText("initial loading")).not.toBeInTheDocument();
    });

    it("hides the source list while the project data loads", async () => {
      mocks.ingestion = { ...mocks.ingestion, isProjectDataLoading: true };
      renderPage();

      await screen.findByRole("region", { name: "Sources" });
      expect(screen.queryByTestId("source-list")).not.toBeInTheDocument();
    });

    it("shows a banner for each failed load", async () => {
      mocks.ingestion = {
        ...mocks.ingestion,
        runsErrorMessage: "runs are down",
        statusErrorMessage: "statuses are down",
        projectSourcesErrorMessage: "sources are down",
      };
      renderPage();

      expect(await screen.findByText("runs are down")).toBeInTheDocument();
      expect(screen.getByText("statuses are down")).toBeInTheDocument();
      expect(screen.getByText("sources are down")).toBeInTheDocument();
    });
  });

  describe("the source badges", () => {
    it("counts the sources in each state, and says need or needs", async () => {
      mocks.sources = [github, jira, broken, source("d", "GITHUB", "disabled")];
      renderPage();

      expect(await screen.findByText("1 connected")).toBeInTheDocument();
      expect(screen.getByText("1 syncing")).toBeInTheDocument();
      expect(screen.getByText("1 needs attention")).toBeInTheDocument();
      expect(screen.getByText("1 disabled")).toBeInTheDocument();
    });

    it("says need attention in the plural", async () => {
      mocks.sources = [broken, source("b2", "GITHUB", "attention")];
      renderPage();

      expect(await screen.findByText("2 need attention")).toBeInTheDocument();
      expect(screen.queryByText(/connected$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/syncing$/)).not.toBeInTheDocument();
    });

    it("shows how many runs there are in total", async () => {
      renderPage();
      expect(await screen.findByText("25 total")).toBeInTheDocument();
    });
  });

  describe("choosing a project", () => {
    it("switches to the project a link names, once, and drops the parameter", async () => {
      renderPage("?projectId=proj2");

      await waitFor(() => expect(mocks.setSelectedProjectId).toHaveBeenCalledWith("proj2"));
      await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("projectId"));
    });

    it("does not select the project that is already selected", async () => {
      renderPage("?projectId=proj1");

      await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("projectId"));
      expect(mocks.setSelectedProjectId).not.toHaveBeenCalled();
    });
  });

  describe("selecting a source", () => {
    it("opens a source's panel with what the viewer may do, and closes it", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Pick Src src-1" }));

      expect(
        await screen.findByText("source panel: Src src-1 project=proj1 manage=true unlink=true"),
      ).toBeInTheDocument();
      expect(screen.getByText("selected: src-1")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close source panel" }));
      await waitFor(() => expect(screen.queryByTestId("source-panel")).not.toBeInTheDocument());
      expect(screen.getByText("selected: none")).toBeInTheDocument();
    });

    it("opens the source a link asked for, on the sources section, and drops the parameter on close", async () => {
      const user = userEvent.setup();
      renderPage("?sourceId=src-2");

      expect(await screen.findByText(/source panel: Src src-2/)).toBeInTheDocument();
      expect(screen.getByText(/section: sources/)).toBeInTheDocument();
      expect(screen.getByTestId("where")).toHaveTextContent("sourceId=src-2");

      await user.click(screen.getByRole("button", { name: "Close source panel" }));
      await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("sourceId"));
    });

    it("opens a source by its component name", async () => {
      renderPage("?sourceId=octo/hello");
      expect(await screen.findByText(/source panel: Src src-1/)).toBeInTheDocument();
    });

    it("opens nothing for a source that is not there", async () => {
      renderPage("?sourceId=ghost");
      await screen.findByText(/section: overview/);
      expect(screen.queryByTestId("source-panel")).not.toBeInTheDocument();
    });

    it("lets only the managing viewer unlink, and only an admin or a manager connect", async () => {
      mocks.permissionGroup = "HR";
      setProject({ isManaged: false });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Pick Src src-1" }));

      expect(await screen.findByText(/manage=false unlink=false/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Manage connectors" })).not.toBeInTheDocument();
    });

    it("lets an admin unlink a project they do not manage", async () => {
      mocks.permissionGroup = "ADMIN";
      setProject({ isManaged: false });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Pick Src src-1" }));

      expect(await screen.findByText(/manage=true unlink=true/)).toBeInTheDocument();
    });

    it("drops the selection when the panel reports the source unlinked", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Pick Src src-1" }));

      await user.click(await screen.findByRole("button", { name: "Panel unlinked" }));

      await waitFor(() => expect(screen.queryByTestId("source-panel")).not.toBeInTheDocument());
    });

    it("keeps the selection for an edit, and opens the polling window for an update", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Pick Src src-1" }));

      await user.click(await screen.findByRole("button", { name: "Panel changed" }));
      expect(screen.getByTestId("source-panel")).toBeInTheDocument();
      expect(mocks.runQueries.some((entry) => (entry as { polling: boolean }).polling)).toBe(false);

      await user.click(screen.getByRole("button", { name: "Panel updated" }));
      await waitFor(() =>
        expect(mocks.runQueries.some((entry) => (entry as { polling: boolean }).polling)).toBe(
          true,
        ),
      );
    });
  });

  describe("the run history", () => {
    async function openRuns(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: "Go runs" }));
    }

    it("asks for the project's runs, ten at a time", async () => {
      renderPage();
      await screen.findByTestId("run-history");

      expect(mocks.runQueries[0]).toMatchObject({
        query: { page: 1, size: 10, projectId: "proj1" },
        polling: false,
      });
    });

    it("offers the sources that can tell their runs apart", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);

      expect(
        screen.getByText(/options=Src src-1,Src https:\/\/team.atlassian.net,Src src-2/),
      ).toBeInTheDocument();
    });

    it("filters by status and goes back to the first page", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);
      await user.click(screen.getByRole("button", { name: "Next runs page" }));
      expect(screen.getByText("page 2 of 3")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Only failed" }));

      expect(screen.getByText("page 1 of 3")).toBeInTheDocument();
      expect(screen.getByText(/filtered: true/)).toBeInTheDocument();
      expect(mocks.runQueries.at(-1)).toMatchObject({ query: { status: "FAILED", page: 1 } });
    });

    it("filters by a source through the parameter its connector names", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);

      await user.click(screen.getByRole("button", { name: "Only jira" }));

      expect(mocks.runQueries.at(-1)).toMatchObject({
        query: { sourceRef: "https://team.atlassian.net", repositoryId: undefined },
      });
    });

    it("filters by nothing in particular for a source it does not know", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);

      await user.click(screen.getByRole("button", { name: "Only unknown" }));

      expect(mocks.runQueries.at(-1)).toMatchObject({
        query: { sourceRef: undefined, repositoryId: undefined },
      });
      expect(screen.getByText(/filtered: true/)).toBeInTheDocument();
    });

    it("resets the filters and the page", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);
      await user.click(screen.getByRole("button", { name: "Only failed" }));
      await user.click(screen.getByRole("button", { name: "Next runs page" }));

      await user.click(screen.getByRole("button", { name: "Reset filters" }));

      expect(screen.getByText("page 1 of 3")).toBeInTheDocument();
      expect(screen.getByText(/filters: ALL ALL/)).toBeInTheDocument();
      expect(screen.getByText(/filtered: false/)).toBeInTheDocument();
    });

    it("shows no pagination for a single page", async () => {
      mocks.ingestion = { ...mocks.ingestion, runPageMeta: { totalElements: 2, totalPages: 1 } };
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);

      expect(screen.queryByRole("button", { name: "Next runs page" })).not.toBeInTheDocument();
    });

    it("steps back to the last page when the viewed page is out of range", async () => {
      mocks.ingestion = { ...mocks.ingestion, runPageMeta: { totalElements: 20, totalPages: 2 } };
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);
      await user.click(screen.getByRole("button", { name: "Next runs page" }));
      expect(screen.getByText("page 2 of 2")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Next runs page" }));

      await waitFor(() => expect(screen.getByText("page 2 of 2")).toBeInTheDocument());
    });

    it("does not step back while the rows are a placeholder", async () => {
      mocks.ingestion = {
        ...mocks.ingestion,
        isRunsPlaceholder: true,
        runPageMeta: { totalElements: 20, totalPages: 1 },
      };
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);
      await user.click(screen.getByRole("button", { name: "Only failed" }));

      expect(
        mocks.runQueries.every((entry) => (entry as { query: { page: number } }).query.page === 1),
      ).toBe(true);
    });

    it("opens a run's panel with the label of its source, and closes it", async () => {
      const user = userEvent.setup();
      renderPage();
      await openRuns(user);

      await user.click(screen.getByRole("button", { name: "Run r1" }));

      expect(await screen.findByText(/run panel: r1/)).toBeInTheDocument();
      expect(screen.getByText("selected run: r1 filtered: false")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Close run panel" }));
      await waitFor(() => expect(screen.queryByTestId("run-panel")).not.toBeInTheDocument());
    });

    it("keeps a run open after the page it was on is gone", async () => {
      const user = userEvent.setup();
      const { rerender } = renderPage();
      await openRuns(user);
      await user.click(screen.getByRole("button", { name: "Run r1" }));
      await screen.findByTestId("run-panel");

      mocks.ingestion = { ...mocks.ingestion, runs: [run("other")] };
      rerender(
        <MemoryRouter initialEntries={["/data-ingestion"]}>
          <DataIngestionPage />
          <Where />
        </MemoryRouter>,
      );

      expect(await screen.findByText(/run panel: r1/)).toBeInTheDocument();
    });
  });

  describe("refreshing", () => {
    it("shows that it is refreshing, and reloads the projects", async () => {
      let finish: () => void = () => {};
      mocks.reloadProjects.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Refresh now" }));
      expect(screen.getByText("header loading: true")).toBeInTheDocument();
      finish();

      await waitFor(() => expect(screen.getByText("header loading: false")).toBeInTheDocument());
      expect(mocks.reloadProjects).toHaveBeenCalledTimes(1);
    });
  });

  describe("connectors", () => {
    async function openConnectors(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: /Manage connectors/ }));
      return screen.findByTestId("connector-list");
    }

    it("lists the connectors in a modal", async () => {
      const user = userEvent.setup();
      renderPage();

      await openConnectors(user);

      expect(screen.getByText("Toggle github (true)")).toBeInTheDocument();
      expect(screen.getByText("toggling: none project=proj1")).toBeInTheDocument();
    });

    it("switches a connector and says so", async () => {
      const user = userEvent.setup();
      renderPage();
      await openConnectors(user);

      await user.click(screen.getByRole("button", { name: "Toggle github (true)" }));

      expect(await screen.findByText("Connector disabled")).toBeInTheDocument();
      expect(mocks.setConnectorEnabled).toHaveBeenCalledWith("github", false);
      expect(
        await screen.findByRole("button", { name: "Toggle github (false)" }),
      ).toBeInTheDocument();
    });

    it("says a switched-on connector was enabled", async () => {
      const user = userEvent.setup();
      renderPage();
      await openConnectors(user);

      await user.click(screen.getByRole("button", { name: "Toggle jira (false)" }));

      expect(await screen.findByText("Connector enabled")).toBeInTheDocument();
    });

    it("says why switching failed", async () => {
      mocks.setConnectorEnabled.mockRejectedValue(new Error("connector is locked"));
      const user = userEvent.setup();
      renderPage();
      await openConnectors(user);

      await user.click(screen.getByRole("button", { name: "Toggle github (true)" }));

      expect(await screen.findByText("connector is locked")).toBeInTheDocument();
      expect(screen.getByText("toggling: none project=proj1")).toBeInTheDocument();
    });

    it("says it in general words when switching fails without a message", async () => {
      mocks.setConnectorEnabled.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await openConnectors(user);

      await user.click(screen.getByRole("button", { name: "Toggle github (true)" }));

      expect(await screen.findByText("Couldn't update the connector.")).toBeInTheDocument();
    });

    it("reloads the page's data when sources were saved", async () => {
      const user = userEvent.setup();
      renderPage();
      await openConnectors(user);

      await user.click(screen.getByRole("button", { name: "Sources saved" }));

      await waitFor(() => expect(mocks.listConnectors.mock.calls.length).toBeGreaterThanOrEqual(1));
    });

    it("shows why the connectors could not be loaded, and tries again when the modal opens", async () => {
      mocks.listConnectors.mockRejectedValue(new Error("connectors are down"));
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mocks.listConnectors).toHaveBeenCalledTimes(1));

      await user.click(await screen.findByRole("button", { name: /Manage connectors/ }));

      expect(await screen.findByText("connectors are down")).toBeInTheDocument();
      await waitFor(() => expect(mocks.listConnectors).toHaveBeenCalledTimes(2));
    });

    it("says it in general words when the failure carries no message", async () => {
      mocks.listConnectors.mockRejectedValue("nope");
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => expect(mocks.listConnectors).toHaveBeenCalled());

      await user.click(await screen.findByRole("button", { name: /Manage connectors/ }));

      expect(await screen.findByText("Failed to load connectors")).toBeInTheDocument();
    });
  });

  describe("sync settings", () => {
    async function openSettings(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: /Manage sync settings/ }));
      return screen.findByTestId("sync-settings");
    }

    it("offers a tab for each schedulable connector the project has sources of", async () => {
      const user = userEvent.setup();
      renderPage();

      await openSettings(user);

      expect(screen.getByText("Github Sync Settings", { exact: false })).toBeInTheDocument();
      expect(screen.getByText("sync system: GITHUB")).toBeInTheDocument();
      expect(
        screen.getByText(/Applying these settings overwrites the sync settings of every/),
      ).toBeInTheDocument();
    });

    it("has no button without schedulable sources", async () => {
      mocks.sources = [];
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Go runs" }));
      await user.click(screen.getByRole("button", { name: "Go sources" }));

      expect(
        screen.queryByRole("button", { name: /Manage sync settings/ }),
      ).not.toBeInTheDocument();
    });

    it("loads the shared schedule, and warns when the sources differ", async () => {
      const user = userEvent.setup();
      renderPage();
      await openSettings(user);

      await user.click(screen.getByRole("button", { name: "Load schedule" }));

      await waitFor(() =>
        expect(mocks.loadSchedule).toHaveBeenCalledWith("GITHUB", mocks.sources, "proj1"),
      );
      expect(
        await screen.findByText(/These sources currently have different schedules\./),
      ).toBeInTheDocument();
    });

    it("applies the schedule to the project's sources and reloads without the projects", async () => {
      const user = userEvent.setup();
      renderPage();
      await openSettings(user);

      await user.click(screen.getByRole("button", { name: "Apply to project" }));

      await waitFor(() =>
        expect(mocks.saveSchedule).toHaveBeenCalledWith(
          "GITHUB",
          mocks.sources,
          "proj1",
          { autoUpdate: true },
          expect.stringContaining("repositories"),
        ),
      );
      expect(mocks.reloadProjects).not.toHaveBeenCalled();
    });

    it("switches the connector with the tabs", async () => {
      const user = userEvent.setup();
      renderPage();
      await openSettings(user);

      await user.click(screen.getByRole("button", { name: /Jira/ }));

      expect(await screen.findByText("sync system: JIRA")).toBeInTheDocument();
      expect(screen.getByText(/Toggle Jira auto update for this project/)).toBeInTheDocument();
    });
  });

  describe("connecting a source", () => {
    it("opens the add-source wizard with the project and the tokens", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Add a source" }));

      expect(
        await screen.findByText(
          /add source: project=proj1 name=Alpha tokens=token-a ingest=true owners=true/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("blocked: no")).toBeInTheDocument();
    });

    it("opens it from an empty list too, and closes it", async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Empty add" }));
      await screen.findByTestId("add-source");
      await user.click(screen.getByRole("button", { name: "Close add source" }));

      await waitFor(() => expect(screen.queryByTestId("add-source")).not.toBeInTheDocument());
    });

    it("only asks for the tokens once the wizard is open", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByTestId("source-list");
      expect(mocks.getPatNames).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Add a source" }));

      await waitFor(() => expect(mocks.getPatNames).toHaveBeenCalledTimes(1));
    });

    it("explains why a member of the project cannot connect", async () => {
      mocks.permissionGroup = "PM";
      setProject({ isManaged: false });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Add a source" }));

      expect(
        await screen.findByText(
          /You can only connect sources to projects you manage\. You are a member of "Alpha"/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(/ingest=false/)).toBeInTheDocument();
    });

    it("asks to select a project first when there is none", async () => {
      mocks.project = {
        ...createProjectContextValue({
          projects: [],
          selectedProject: null,
          selectedProjectId: "",
        }),
        setSelectedProjectId: mocks.setSelectedProjectId,
        reloadProjects: mocks.reloadProjects,
      };
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Add a source" }));

      expect(
        await screen.findByText("blocked: Select a project before connecting sources."),
      ).toBeInTheDocument();
    });

    it("jumps to the sources list, opens the polling window and reloads when connected", async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Go runs" }));
      await user.click(screen.getByRole("button", { name: "Add a source" }));

      await user.click(await screen.findByRole("button", { name: "Connected a source" }));

      expect(screen.getByText(/section: sources/)).toBeInTheDocument();
      await waitFor(() => expect(mocks.reloadProjects).toHaveBeenCalledTimes(1));
      expect(mocks.runQueries.some((entry) => (entry as { polling: boolean }).polling)).toBe(true);
    });

    it("closes the polling window again once it has run its course", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        renderPage();
        await user.click(await screen.findByRole("button", { name: "Add a source" }));
        await user.click(await screen.findByRole("button", { name: "Connected a source" }));
        await waitFor(() =>
          expect((mocks.runQueries.at(-1) as { polling: boolean }).polling).toBe(true),
        );

        await vi.advanceTimersByTimeAsync(60_000);

        await waitFor(() =>
          expect((mocks.runQueries.at(-1) as { polling: boolean }).polling).toBe(false),
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("shows the sync-settings buttons only to those who may change them", async () => {
    mocks.permissionGroup = "HR";
    renderPage();
    await screen.findByTestId("source-list");

    expect(
      within(screen.getByRole("region", { name: "Sources" })).queryAllByRole("button", {
        name: /Manage/,
      }),
    ).toHaveLength(0);
  });
});
