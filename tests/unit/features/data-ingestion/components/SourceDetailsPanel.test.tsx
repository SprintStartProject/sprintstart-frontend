import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitBranch } from "lucide-react";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidePanel } from "../../../../../src/components/ui/SidePanel";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { SourceDetailsPanel } from "../../../../../src/features/data-ingestion/components/SourceDetailsPanel";
import type {
  BitbucketRepositoryDetails,
  DataSource,
  GithubRepositoryDetails,
  NotionWorkspaceSourceDetails,
} from "../../../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";

const mocks = vi.hoisted(() => ({
  updateGithubRepository: vi.fn(),
  removeRepositoryFromProject: vi.fn(),
  getGithubRepositoryConfig: vi.fn(),
  configureGithubRepository: vi.fn(),
  updateJiraInstance: vi.fn(),
  removeJiraInstanceFromProject: vi.fn(),
  getJiraConfig: vi.fn(),
  configureJiraInstance: vi.fn(),
  updateBitbucketRepository: vi.fn(),
  removeBitbucketRepositoryFromProject: vi.fn(),
  getBitbucketRepositoryConfig: vi.fn(),
  configureBitbucketRepository: vi.fn(),
  syncConnection: vi.fn(),
  deleteConnection: vi.fn(),
  getConnection: vi.fn(),
  configureSchedule: vi.fn(),
  notionSyncConnection: vi.fn(),
  notionDeleteConnection: vi.fn(),
  notionListConnections: vi.fn(),
  notionConfigureSchedule: vi.fn(),
  patchConnectorSources: vi.fn(),
}));

vi.mock("../../../../../src/services/sources/githubService", () => ({
  updateGithubRepository: mocks.updateGithubRepository,
  removeRepositoryFromProject: mocks.removeRepositoryFromProject,
  getGithubRepositoryConfig: mocks.getGithubRepositoryConfig,
  configureGithubRepository: mocks.configureGithubRepository,
}));

vi.mock("../../../../../src/services/sources/bitbucketService", () => ({
  updateBitbucketRepository: mocks.updateBitbucketRepository,
  removeBitbucketRepositoryFromProject: mocks.removeBitbucketRepositoryFromProject,
  getBitbucketRepositoryConfig: mocks.getBitbucketRepositoryConfig,
  configureBitbucketRepository: mocks.configureBitbucketRepository,
}));

vi.mock("../../../../../src/services/sources/jiraService", () => ({
  updateJiraInstance: mocks.updateJiraInstance,
  removeJiraInstanceFromProject: mocks.removeJiraInstanceFromProject,
  getJiraConfig: mocks.getJiraConfig,
  configureJiraInstance: mocks.configureJiraInstance,
}));

vi.mock("../../../../../src/services/sources/confluenceService", () => ({
  confluenceService: {
    syncConnection: mocks.syncConnection,
    deleteConnection: mocks.deleteConnection,
    getConnection: mocks.getConnection,
    configureSchedule: mocks.configureSchedule,
  },
}));

vi.mock("../../../../../src/services/sources/notionService", () => ({
  notionService: {
    syncConnection: mocks.notionSyncConnection,
    deleteConnection: mocks.notionDeleteConnection,
    listConnections: mocks.notionListConnections,
    configureSchedule: mocks.notionConfigureSchedule,
  },
}));

vi.mock("../../../../../src/services/connectorService", () => ({
  connectorService: { patchConnectorSources: mocks.patchConnectorSources },
}));

/**
 * The panel surfaces action outcomes through the app-wide toast system, so
 * every render is wrapped in a ToastProvider — otherwise `useToast` no-ops and
 * the success/error toasts never mount. The router is there for the link to the
 * knowledge base.
 */
const render = (ui: Parameters<typeof rtlRender>[0]) =>
  rtlRender(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    ),
  });

const githubRepository: GithubRepositoryDetails = {
  owner: "acme",
  name: "monorepo",
  repositoryId: "repo-1",
  fullName: "acme/monorepo",
  url: "https://github.com/acme/monorepo",
  enabled: true,
};

const noSyncTimes = { commits: null, issues: null, pullRequests: null };

const mockSource: DataSource = {
  sourceId: "source-github",
  sourceSystem: "GITHUB",
  name: "GitHub Repository",
  type: "GitHub",
  icon: GitBranch,
  status: "connected",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 10,
  lastSync: "2026-07-05",
  errors: 0,
  latestIngestedCount: 10,
  latestUpdatedCount: 3,
  totalArtifactCount: 10,
  deletedCount: 0,
  sharesSourceSystem: false,
  lastRunAt: "2026-07-05T10:00:00Z",
  failedItems: [],
  details: { system: "GITHUB", repository: githubRepository, syncTimes: noSyncTimes },
  description: "Indexes repositories.",
};

const bitbucketRepository: BitbucketRepositoryDetails = {
  repositoryId: "bb-1",
  workspace: "acme",
  slug: "widgets",
  fullName: "acme/widgets",
  url: "https://bitbucket.org/acme/widgets",
  enabled: true,
};

const bitbucketSource: DataSource = {
  ...mockSource,
  sourceId: "bb-1",
  sourceSystem: "BITBUCKET",
  name: "Bitbucket Repository",
  type: "Bitbucket",
  details: {
    system: "BITBUCKET",
    repository: bitbucketRepository,
    syncTimes: { pullRequests: null },
  },
};

const jiraInstance = {
  instanceUrl: "https://acme.atlassian.net",
  displayName: "Team board",
  credentialName: "default",
  credentialUserEmail: "jira@corp.com",
};

const jiraSource: DataSource = {
  ...mockSource,
  sourceId: "https://acme.atlassian.net",
  sourceSystem: "JIRA",
  name: "Team board",
  type: "Jira",
  details: { system: "JIRA", instance: jiraInstance, syncTimes: { issues: null } },
};

const confluenceSource: DataSource = {
  ...mockSource,
  sourceId: "https://acme.atlassian.net|123456",
  sourceSystem: "CONFLUENCE",
  name: "Engineering",
  type: "Confluence",
  details: {
    system: "CONFLUENCE",
    space: {
      connectionId: "conn-1",
      baseUrl: "https://acme.atlassian.net",
      spaceId: "123456",
      spaceKey: "ENG",
      spaceName: "Engineering",
      credentialName: "default",
    },
  },
};

const notionWorkspace: NotionWorkspaceSourceDetails = {
  connectionId: "notion-conn-1",
  sourceRef: "ws-1",
  workspaceName: "Acme Workspace",
  credentialName: "wiki",
};

const notionSource: DataSource = {
  ...mockSource,
  sourceId: "notion-conn-1",
  sourceSystem: "NOTION",
  name: "Acme Workspace",
  type: "Notion",
  details: { system: "NOTION", workspace: notionWorkspace },
};

const uploadSource: DataSource = {
  ...mockSource,
  sourceId: "upload-1",
  sourceSystem: "UPLOAD",
  name: "Uploaded Documentation",
  type: "Upload",
  details: { system: "UPLOAD" },
};

const interval = (everyMinutes: number) => ({ type: "INTERVAL", everyMinutes }) as const;

/** A Notion connection record carrying the given stored schedule. */
function notionConnectionRecord(stored: {
  autoUpdate: boolean;
  spec: ReturnType<typeof interval>;
  nextSyncAt: string | null;
}) {
  return {
    id: "notion-conn-1",
    projectId: "p1",
    workspaceId: "ws-1",
    workspaceName: "Acme Workspace",
    workspaceUrl: "https://www.notion.so/acme",
    credentialName: "wiki",
    sourceEnabled: true,
    autoUpdate: stored.autoUpdate,
    schedule: "every 60 minutes",
    scheduleSpec: stored.spec,
    nextSyncAt: stored.nextSyncAt,
    lastSyncedAt: null,
    createdAt: "2026-10-05T09:00:00Z",
    updatedAt: "2026-10-05T09:00:00Z",
    version: 1,
  };
}

function notionSyncResult(overrides: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    connectionId: "notion-conn-1",
    outcome: "COMPLETED",
    failure: null,
    successfulPages: 5,
    failedPages: 0,
    removedPages: 0,
    ...overrides,
  };
}

type PanelProps = ComponentProps<typeof SourceDetailsPanel>;

/** The panel with a manager's permissions and a no-op `onChanged`, unless overridden. */
function panel(source: DataSource, props: Partial<PanelProps> = {}) {
  return (
    <SourceDetailsPanel
      source={source}
      projectId="p1"
      canManage
      canUnlink
      onChanged={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      {...props}
    />
  );
}

/**
 * What each connector's actions are expected to call. The panel is the same for
 * every connector, so every case runs through the same tests.
 */
const cases = [
  {
    name: "GitHub",
    source: mockSource,
    section: "Repository",
    updateButton: /Update repo/,
    expectUpdate: () => expect(mocks.updateGithubRepository).toHaveBeenCalledWith(githubRepository),
    toggleName: /Toggle ingestion for GitHub Repository/,
    expectDisabled: () =>
      expect(mocks.patchConnectorSources).toHaveBeenCalledWith("github", [
        { sourceId: "acme/monorepo", enabled: false },
      ]),
    autoUpdateName: /Toggle repository auto update/,
    expectScheduleLoaded: () =>
      expect(mocks.getGithubRepositoryConfig).toHaveBeenCalledWith(githubRepository),
    expectScheduleSaved: () =>
      expect(mocks.configureGithubRepository).toHaveBeenCalledWith(githubRepository, {
        autoUpdate: false,
        schedule: interval(30),
      }),
    unlinkTitle: /Remove repository from project/,
    expectUnlinked: () =>
      expect(mocks.removeRepositoryFromProject).toHaveBeenCalledWith("repo-1", "p1"),
  },
  {
    name: "Bitbucket",
    source: bitbucketSource,
    section: "Repository",
    updateButton: /Update repository/,
    expectUpdate: () => expect(mocks.updateBitbucketRepository).toHaveBeenCalledWith("bb-1"),
    toggleName: /Toggle ingestion for Bitbucket Repository/,
    expectDisabled: () =>
      expect(mocks.patchConnectorSources).toHaveBeenCalledWith("bitbucket", [
        { sourceId: "acme/widgets", enabled: false },
      ]),
    autoUpdateName: /Toggle repository auto update/,
    expectScheduleLoaded: () =>
      expect(mocks.getBitbucketRepositoryConfig).toHaveBeenCalledWith(bitbucketRepository),
    expectScheduleSaved: () =>
      expect(mocks.configureBitbucketRepository).toHaveBeenCalledWith(bitbucketRepository, {
        autoUpdate: false,
        schedule: interval(30),
      }),
    unlinkTitle: /Remove repository from project/,
    expectUnlinked: () =>
      expect(mocks.removeBitbucketRepositoryFromProject).toHaveBeenCalledWith("bb-1", "p1"),
  },
  {
    name: "Jira",
    source: jiraSource,
    section: "Instance",
    updateButton: /Update instance/,
    expectUpdate: () =>
      expect(mocks.updateJiraInstance).toHaveBeenCalledWith({
        instanceUrl: "https://acme.atlassian.net",
      }),
    toggleName: /Toggle ingestion for Team board/,
    expectDisabled: () =>
      expect(mocks.patchConnectorSources).toHaveBeenCalledWith("jira", [
        { sourceId: "https://acme.atlassian.net", enabled: false },
      ]),
    autoUpdateName: /Toggle instance auto update/,
    expectScheduleLoaded: () =>
      expect(mocks.getJiraConfig).toHaveBeenCalledWith("https://acme.atlassian.net"),
    expectScheduleSaved: () =>
      expect(mocks.configureJiraInstance).toHaveBeenCalledWith({
        instanceUrl: "https://acme.atlassian.net",
        autoUpdate: false,
        schedule: interval(30),
      }),
    unlinkTitle: /Remove instance from project/,
    expectUnlinked: () =>
      expect(mocks.removeJiraInstanceFromProject).toHaveBeenCalledWith(
        "https://acme.atlassian.net",
        "p1",
      ),
  },
  {
    name: "Confluence",
    source: confluenceSource,
    section: "Space",
    updateButton: /Update space/,
    expectUpdate: () => expect(mocks.syncConnection).toHaveBeenCalledWith("p1", "conn-1"),
    toggleName: /Toggle ingestion for Engineering/,
    expectDisabled: () =>
      expect(mocks.patchConnectorSources).toHaveBeenCalledWith(
        "confluence",
        [{ sourceId: "conn-1", enabled: false }],
        "p1",
      ),
    autoUpdateName: /Toggle space auto update/,
    expectScheduleLoaded: () => expect(mocks.getConnection).toHaveBeenCalledWith("p1", "conn-1"),
    expectScheduleSaved: () =>
      expect(mocks.configureSchedule).toHaveBeenCalledWith("p1", "conn-1", {
        autoUpdate: false,
        schedule: interval(30),
      }),
    unlinkTitle: /Remove space from project/,
    expectUnlinked: () => expect(mocks.deleteConnection).toHaveBeenCalledWith("p1", "conn-1"),
  },
  {
    name: "Notion",
    source: notionSource,
    section: "Workspace",
    updateButton: /Update workspace/,
    expectUpdate: () =>
      expect(mocks.notionSyncConnection).toHaveBeenCalledWith("p1", "notion-conn-1"),
    toggleName: /Toggle ingestion for Acme Workspace/,
    expectDisabled: () =>
      expect(mocks.patchConnectorSources).toHaveBeenCalledWith(
        "notion",
        [{ sourceId: "notion-conn-1", enabled: false }],
        "p1",
      ),
    autoUpdateName: /Toggle workspace auto update/,
    expectScheduleLoaded: () => expect(mocks.notionListConnections).toHaveBeenCalledWith("p1"),
    expectScheduleSaved: () =>
      expect(mocks.notionConfigureSchedule).toHaveBeenCalledWith("p1", "notion-conn-1", {
        autoUpdate: false,
        schedule: interval(30),
      }),
    unlinkTitle: /Remove workspace from project/,
    expectUnlinked: () =>
      expect(mocks.notionDeleteConnection).toHaveBeenCalledWith("p1", "notion-conn-1"),
  },
];

describe("SourceDetailsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();

    mocks.updateGithubRepository.mockResolvedValue({ transactionId: "tx" });
    mocks.removeRepositoryFromProject.mockResolvedValue({ repositoryId: "repo-1", projectIds: [] });
    mocks.configureGithubRepository.mockResolvedValue(undefined);
    mocks.updateBitbucketRepository.mockResolvedValue({ transactionId: "tx" });
    mocks.removeBitbucketRepositoryFromProject.mockResolvedValue({
      repositoryId: "bb-1",
      projectIds: [],
    });
    mocks.configureBitbucketRepository.mockResolvedValue(undefined);
    mocks.updateJiraInstance.mockResolvedValue({ transactionId: "tx" });
    mocks.removeJiraInstanceFromProject.mockResolvedValue(undefined);
    mocks.configureJiraInstance.mockResolvedValue(undefined);
    mocks.syncConnection.mockResolvedValue({
      status: "COMPLETED",
      created: 1,
      updated: 2,
      unchanged: 3,
      failed: 0,
      discovered: 6,
    });
    mocks.deleteConnection.mockResolvedValue(undefined);
    mocks.configureSchedule.mockResolvedValue({});
    mocks.notionSyncConnection.mockResolvedValue(notionSyncResult());
    mocks.notionDeleteConnection.mockResolvedValue(undefined);
    mocks.notionConfigureSchedule.mockResolvedValue({});
    mocks.patchConnectorSources.mockResolvedValue({ connectorId: "x", sources: [] });

    const stored = { autoUpdate: true, spec: interval(60), nextSyncAt: null };
    mocks.getGithubRepositoryConfig.mockResolvedValue(stored);
    mocks.getBitbucketRepositoryConfig.mockResolvedValue(stored);
    mocks.getJiraConfig.mockResolvedValue(stored);
    mocks.getConnection.mockResolvedValue(stored);
    mocks.notionListConnections.mockResolvedValue([notionConnectionRecord(stored)]);
  });

  describe.each(cases)("$name source", (connector) => {
    it("renders its own identity card", () => {
      render(panel(connector.source));

      expect(screen.getByText(connector.section)).toBeInTheDocument();
      expect(screen.getByText("Ingestion")).toBeInTheDocument();
    });

    it("switches ingestion off and reports the change", async () => {
      const user = userEvent.setup();
      const onChanged = vi.fn().mockResolvedValue(undefined);

      render(panel(connector.source, { onChanged }));
      await user.click(screen.getByRole("switch", { name: connector.toggleName }));

      await waitFor(() => expect(onChanged).toHaveBeenCalledWith("changed"));
      connector.expectDisabled();
      expect(await screen.findByText("Source disabled")).toBeInTheDocument();
    });

    it("shows the inclusion as plain text to anyone who cannot manage the source", () => {
      render(panel(connector.source, { canManage: false }));

      expect(screen.queryByRole("switch", { name: connector.toggleName })).not.toBeInTheDocument();
      expect(screen.getByText("Enabled")).toBeInTheDocument();
      expect(screen.queryByText("Sync Schedule")).not.toBeInTheDocument();
    });

    it("runs its update and reports it", async () => {
      const user = userEvent.setup();
      const onChanged = vi.fn().mockResolvedValue(undefined);

      render(panel(connector.source, { onChanged }));
      await user.click(screen.getByRole("button", { name: connector.updateButton }));

      await waitFor(() => expect(onChanged).toHaveBeenCalledWith("updated"));
      connector.expectUpdate();
    });

    it("loads its sync schedule and saves an edit of it", async () => {
      const user = userEvent.setup();
      const onChanged = vi.fn().mockResolvedValue(undefined);

      render(panel(connector.source, { onChanged }));

      expect(screen.getByText("Sync Schedule")).toBeInTheDocument();
      await waitFor(() => connector.expectScheduleLoaded());

      const minutes = await screen.findByLabelText("Minutes");
      await user.clear(minutes);
      await user.type(minutes, "30");
      await user.click(screen.getByRole("switch", { name: connector.autoUpdateName }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => connector.expectScheduleSaved());
      await waitFor(() => expect(onChanged).toHaveBeenCalledWith("changed"));
    });

    it("unlinks only after the confirmation dialog", async () => {
      const user = userEvent.setup();
      const onChanged = vi.fn().mockResolvedValue(undefined);

      render(panel(connector.source, { onChanged }));
      await user.click(screen.getByRole("button", { name: /Remove from project/ }));

      // The confirmation dialog gates the destructive call.
      expect(onChanged).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog", { name: connector.unlinkTitle })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /^Remove$/ }));

      await waitFor(() => expect(onChanged).toHaveBeenCalledWith("unlinked"));
      connector.expectUnlinked();
      expect(await screen.findByText("Removed from project")).toBeInTheDocument();
    });

    it("does not offer to remove the source without permission to unlink", () => {
      render(panel(connector.source, { canUnlink: false }));

      expect(screen.queryByRole("button", { name: /Remove from project/ })).not.toBeInTheDocument();
    });
  });

  it("shows the Jira credential name but not the credential's email", () => {
    render(panel(jiraSource));

    expect(screen.getByText("Credential")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.queryByText("jira@corp.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Repository")).not.toBeInTheDocument();
  });

  it("leaves the update toasts to the Confluence sync, which reports its own outcome", async () => {
    const user = userEvent.setup();
    mocks.syncConnection.mockRejectedValue(new Error("sync exploded"));

    render(panel(confluenceSource));
    await user.click(screen.getByRole("button", { name: /Update space/ }));

    // Reported once by the sync itself, not a second time by the panel.
    expect(await screen.findAllByText("sync exploded")).toHaveLength(1);
    expect(screen.queryByText("Update started")).not.toBeInTheDocument();
  });

  it("reports a Confluence sync that finished with errors as a warning", async () => {
    const user = userEvent.setup();
    mocks.syncConnection.mockResolvedValue({
      status: "PARTIAL",
      created: 1,
      updated: 0,
      unchanged: 0,
      failed: 2,
      discovered: 3,
    });

    render(panel(confluenceSource));
    await user.click(screen.getByRole("button", { name: /Update space/ }));

    expect(await screen.findByText("Confluence sync finished with errors")).toBeInTheDocument();
    expect(screen.getByText("2 pages failed out of 3 discovered.")).toBeInTheDocument();
  });

  it("reports a Notion sync's page counts once and leaves the toasts to the sync", async () => {
    const user = userEvent.setup();
    mocks.notionSyncConnection.mockResolvedValue(notionSyncResult({ removedPages: 2 }));

    render(panel(notionSource));
    await user.click(screen.getByRole("button", { name: /Update workspace/ }));

    expect(await screen.findByText("Notion workspace synced")).toBeInTheDocument();
    expect(screen.getByText("5 pages synced, 2 removed.")).toBeInTheDocument();
    expect(screen.queryByText("Update started")).not.toBeInTheDocument();
  });

  it("reports a Notion sync that finished with failed pages as a warning", async () => {
    const user = userEvent.setup();
    mocks.notionSyncConnection.mockResolvedValue(
      notionSyncResult({ outcome: "PARTIAL", successfulPages: 3, failedPages: 2 }),
    );

    render(panel(notionSource));
    await user.click(screen.getByRole("button", { name: /Update workspace/ }));

    expect(await screen.findByText("Notion sync finished with errors")).toBeInTheDocument();
    expect(screen.getByText("2 pages failed, 3 synced.")).toBeInTheDocument();
  });

  it("reports a failed Notion run with the backend's reason", async () => {
    const user = userEvent.setup();
    mocks.notionSyncConnection.mockResolvedValue(
      notionSyncResult({
        outcome: "FAILED",
        successfulPages: 0,
        failure: { stage: "FETCHING", message: "Notion source is disabled" },
      }),
    );

    render(panel(notionSource));
    await user.click(screen.getByRole("button", { name: /Update workspace/ }));

    expect(await screen.findByText("Notion sync failed")).toBeInTheDocument();
    expect(screen.getByText("Notion source is disabled (fetching)")).toBeInTheDocument();
  });

  it("tells a Notion workspace without visible pages how to share some", async () => {
    const user = userEvent.setup();
    mocks.notionSyncConnection.mockResolvedValue(notionSyncResult({ successfulPages: 0 }));

    render(panel(notionSource));
    await user.click(screen.getByRole("button", { name: /Update workspace/ }));

    expect(await screen.findByText(/Share pages with the Notion integration/)).toBeInTheDocument();
  });

  it("shows the Notion workspace and credential, without a link to notion.so", () => {
    render(panel(notionSource));

    expect(screen.getByText("Credential")).toBeInTheDocument();
    expect(screen.getByText("wiki")).toBeInTheDocument();
    expect(screen.queryByText("URL")).not.toBeInTheDocument();
  });

  it("disables the Notion update and hides unlinking without a connection record", () => {
    render(
      panel({
        ...notionSource,
        details: { system: "NOTION", workspace: { ...notionWorkspace, connectionId: null } },
      }),
    );

    expect(screen.getByRole("button", { name: /Update workspace/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Remove from project/ })).not.toBeInTheDocument();
  });

  it("says a Notion workspace is skipped, not marked out of date, with auto update off", async () => {
    mocks.notionListConnections.mockResolvedValue([
      notionConnectionRecord({ autoUpdate: false, spec: interval(60), nextSyncAt: null }),
    ]);

    render(panel(notionSource));

    expect(
      await screen.findByText(
        "Due checks skip this workspace. It only updates when started manually.",
      ),
    ).toBeInTheDocument();
  });

  it("announces that a background update started for GitHub and Jira", async () => {
    const user = userEvent.setup();

    render(panel(mockSource));
    await user.click(screen.getByRole("button", { name: /Update repo/ }));

    expect(await screen.findByText("Update started")).toBeInTheDocument();
  });

  it("surfaces the error message when an update cannot be started", async () => {
    const user = userEvent.setup();
    mocks.updateGithubRepository.mockRejectedValue(new Error("GitHub is down."));

    render(panel(mockSource));
    await user.click(screen.getByRole("button", { name: /Update repo/ }));

    expect(await screen.findByText("GitHub is down.")).toBeInTheDocument();
  });

  it("surfaces the error message when unlinking fails", async () => {
    const user = userEvent.setup();
    mocks.removeRepositoryFromProject.mockRejectedValue(
      new Error("You cannot access this project."),
    );

    render(panel(mockSource));
    await user.click(screen.getByRole("button", { name: /Remove from project/ }));
    await user.click(screen.getByRole("button", { name: /^Remove$/ }));

    expect(await screen.findByText("You cannot access this project.")).toBeInTheDocument();
  });

  it("renders repository and ingestion details", () => {
    render(panel(mockSource));

    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("acme/monorepo")).toBeInTheDocument();
    expect(screen.getByText("Ingestion")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("reloads through onChanged when the refresh button is clicked", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);

    render(panel(mockSource, { onChanged }));
    await user.click(screen.getByRole("button", { name: /Refresh details/ }));

    expect(onChanged).toHaveBeenCalledWith("changed");
    expect(await screen.findByText("Source details refreshed")).toBeInTheDocument();
  });

  it("disables repository updates when repository details are unavailable", () => {
    render(
      panel({
        ...mockSource,
        details: { system: "GITHUB", repository: null, syncTimes: noSyncTimes },
      }),
    );

    expect(screen.getByRole("button", { name: /Update repo/ })).toBeDisabled();
  });

  it("offers no update action for an upload source", () => {
    render(panel(uploadSource));

    // No disabled GitHub-labelled button either: the action simply does not exist.
    expect(screen.queryByRole("button", { name: /Update/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh details/ })).toBeEnabled();
    expect(screen.queryByText("Sync Schedule")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove from project/ })).not.toBeInTheDocument();
  });

  it("hides the remove-from-project action when the repository has no id", () => {
    render(
      panel({
        ...mockSource,
        details: {
          system: "GITHUB",
          repository: { ...githubRepository, repositoryId: null },
          syncTimes: noSyncTimes,
        },
      }),
    );

    expect(screen.queryByRole("button", { name: /Remove from project/ })).not.toBeInTheDocument();
  });

  describe("knowledge base link", () => {
    const linkName = /Browse in the knowledge base/;

    it("links a GitHub source to its repository in the knowledge base", () => {
      render(panel(mockSource));

      expect(screen.getByRole("link", { name: linkName })).toHaveAttribute(
        "href",
        "/knowledge-base?sources=GITHUB&repos=acme/monorepo",
      );
    });

    it("links a Jira source to the Jira system", () => {
      render(panel(jiraSource));

      expect(screen.getByRole("link", { name: linkName })).toHaveAttribute(
        "href",
        "/knowledge-base?sources=JIRA",
      );
    });

    it("links a Notion source to the Notion system and counts its pages", () => {
      render(panel(notionSource));

      const link = screen.getByRole("link", { name: linkName });
      expect(link).toHaveAttribute("href", "/knowledge-base?sources=NOTION");
      expect(link).toHaveTextContent("10 artifacts · Notion");
    });

    it("links a Bitbucket source to its repository in the knowledge base", () => {
      render(panel(bitbucketSource));

      expect(screen.getByRole("link", { name: linkName })).toHaveAttribute(
        "href",
        "/knowledge-base?sources=BITBUCKET&repos=acme/widgets",
      );
      expect(screen.getByRole("link", { name: linkName })).toHaveTextContent(
        "10 artifacts · acme/widgets",
      );
    });

    it("tells a GitHub source's artifact count and repository", () => {
      render(panel(mockSource));

      expect(screen.getByRole("link", { name: linkName })).toHaveTextContent(
        "10 artifacts · acme/monorepo",
      );
    });

    it("tells a Jira source's artifact count and system", () => {
      render(panel(jiraSource));

      expect(screen.getByRole("link", { name: linkName })).toHaveTextContent("10 artifacts · Jira");
    });

    it("is absent while the source has no artifacts", () => {
      render(panel({ ...mockSource, artifacts: 0, totalArtifactCount: 0 }));

      expect(screen.queryByRole("link", { name: linkName })).not.toBeInTheDocument();
    });
  });

  it("renders failed items from the source", () => {
    render(
      panel({
        ...mockSource,
        errors: 1,
        failedItems: [
          {
            artifactType: "FILE",
            reference: "broken.md",
            reason: "Parse error",
          },
        ],
      }),
    );

    expect(screen.getByText("Failed Items")).toBeInTheDocument();
    expect(screen.getByText("File: broken.md")).toBeInTheDocument();
    expect(screen.getByText("Parse error")).toBeInTheDocument();
  });

  it("renders Jira issue data as one combined sync resource", () => {
    render(
      panel({
        ...jiraSource,
        details: {
          system: "JIRA",
          instance: jiraInstance,
          syncTimes: { issues: "2026-07-05T10:00:00Z" },
        },
      }),
    );

    expect(screen.getByText("Last Synced")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.queryByText("Commits")).not.toBeInTheDocument();
    expect(screen.queryByText("Pull requests")).not.toBeInTheDocument();
  });

  it("shows the Bitbucket workspace and slug and no GitHub-only rows", () => {
    render(panel(bitbucketSource));

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("Slug")).toBeInTheDocument();
    expect(screen.getByText("widgets")).toBeInTheDocument();
    expect(screen.getByText("bb-1")).toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("lists only the pull-request sync time of a Bitbucket repository", () => {
    render(
      panel({
        ...bitbucketSource,
        details: {
          system: "BITBUCKET",
          repository: bitbucketRepository,
          syncTimes: { pullRequests: "2026-07-05T10:00:00Z" },
        },
      }),
    );

    expect(screen.getByText("Last Synced")).toBeInTheDocument();
    expect(screen.getByText("Pull requests")).toBeInTheDocument();
    expect(screen.queryByText("Commits")).not.toBeInTheDocument();
    expect(screen.queryByText("Issues")).not.toBeInTheDocument();
  });

  it("disables the Bitbucket update and hides unlinking without a connection id", () => {
    render(
      panel({
        ...bitbucketSource,
        details: {
          system: "BITBUCKET",
          repository: { ...bitbucketRepository, repositoryId: null },
          syncTimes: { pullRequests: null },
        },
      }),
    );

    expect(screen.getByRole("button", { name: /Update repository/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Remove from project/ })).not.toBeInTheDocument();
  });

  it("says a Bitbucket repository is skipped, not marked out of date, with auto update off", async () => {
    mocks.getBitbucketRepositoryConfig.mockResolvedValue({
      autoUpdate: false,
      spec: interval(60),
      nextSyncAt: null,
    });
    mocks.getGithubRepositoryConfig.mockResolvedValue({
      autoUpdate: false,
      spec: interval(60),
      nextSyncAt: null,
    });

    const { unmount } = render(panel(bitbucketSource));
    expect(
      await screen.findByText(
        "Due checks skip this repository. It only updates when started manually.",
      ),
    ).toBeInTheDocument();
    unmount();

    render(panel(mockSource));
    expect(
      await screen.findByText("Due checks only mark this repository out of date."),
    ).toBeInTheDocument();
  });

  it("keeps the three GitHub sync resource types", () => {
    render(
      panel({
        ...mockSource,
        details: {
          system: "GITHUB",
          repository: githubRepository,
          syncTimes: {
            commits: "2026-07-05T10:00:00Z",
            issues: "2026-07-05T10:00:00Z",
            pullRequests: "2026-07-05T10:00:00Z",
          },
        },
      }),
    );

    expect(screen.getByText("Commits")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Pull requests")).toBeInTheDocument();
  });

  describe("waiting game", () => {
    const syncing = (source: DataSource): DataSource => ({
      ...source,
      statusView: {
        state: "syncing",
        label: "Syncing",
        icon: GitBranch,
        tone: "brand",
        spinning: true,
      },
    });

    it("does not show space hint or open DinoGame when dino is locked", () => {
      render(panel(syncing(mockSource)));

      expect(screen.queryByText(/to pass the time/i)).not.toBeInTheDocument();
      fireEvent.keyDown(window, { code: "Space" });
      expect(
        screen.queryByRole("application", { name: /mini dino game/i }),
      ).not.toBeInTheDocument();
    });

    it("shows space hint when syncing and dino is unlocked, and starts DinoGame on Space", async () => {
      window.localStorage.setItem("dinoUnlocked", "true");

      render(panel(syncing(mockSource)));

      expect(screen.getByText(/to pass the time/i)).toBeInTheDocument();
      fireEvent.keyDown(window, { code: "Space" });

      expect(
        await screen.findByRole("application", { name: /mini dino game/i }),
      ).toBeInTheDocument();
    });

    it("shows 'Sync complete' badge when syncing finishes while game is active", async () => {
      window.localStorage.setItem("dinoUnlocked", "true");

      const { rerender } = render(panel(syncing(mockSource)));

      fireEvent.keyDown(window, { code: "Space" });
      expect(
        await screen.findByRole("application", { name: /mini dino game/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/sync complete/i)).not.toBeInTheDocument();

      // Source finishes syncing
      rerender(panel(mockSource));

      expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent(/sync complete/i);
    });

    it("withholds the completion badge while an update request is still in flight", async () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const user = userEvent.setup();
      let resolveUpdate: () => void = () => {};
      mocks.updateGithubRepository.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      render(panel(mockSource));
      // SidePanel moves focus into the drawer on the next animation frame; let it
      // land before the click, or it could pull focus off the Update button after.
      await waitFor(() =>
        expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement),
      );
      await user.click(screen.getByRole("button", { name: /Update repo/ }));
      // Focus stays on the Update button, now disabled while the request runs.
      // Space on a disabled control has no meaning of its own, so it opens the game.
      expect(screen.getByRole("button", { name: /Update repo/ })).toHaveFocus();
      fireEvent.keyDown(window, { code: "Space" });
      expect(await screen.findByTestId("dino-game")).toBeInTheDocument();

      // Status still reads "connected", but the update has not settled yet.
      expect(screen.queryByTestId("dino-game-reply-ready")).not.toBeInTheDocument();

      resolveUpdate();

      await waitFor(() =>
        expect(screen.getByTestId("dino-game-reply-ready")).toHaveTextContent(/sync complete/i),
      );
      expect(screen.getByTestId("dino-game-reply-ready")).toHaveAttribute("data-tone", "success");
    });

    it("reports 'Sync failed' instead of 'Sync complete' when the sync ends in attention", async () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const failedSource: DataSource = {
        ...mockSource,
        statusView: deriveSourceStatus({ hasErrors: true, hasNeverSynced: false }),
      };

      const { rerender } = render(panel(syncing(mockSource)));
      fireEvent.keyDown(window, { code: "Space" });
      expect(await screen.findByTestId("dino-game")).toBeInTheDocument();

      rerender(panel(failedSource));

      const badge = screen.getByTestId("dino-game-reply-ready");
      expect(badge).toHaveTextContent(/sync failed/i);
      expect(badge).toHaveAttribute("data-tone", "danger");
      expect(screen.queryByText(/sync complete/i)).not.toBeInTheDocument();
    });

    it("first Escape closes the dino game but not the drawer; second Escape closes the drawer", async () => {
      window.localStorage.setItem("dinoUnlocked", "true");
      const onDrawerClose = vi.fn();

      render(
        <SidePanel isOpen onClose={onDrawerClose} title="Source details">
          {panel(syncing(mockSource))}
        </SidePanel>,
      );

      fireEvent.keyDown(window, { code: "Space" });
      expect(await screen.findByTestId("dino-game")).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
      expect(screen.queryByTestId("dino-game")).not.toBeInTheDocument();
      expect(onDrawerClose).not.toHaveBeenCalled();

      fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
      expect(onDrawerClose).toHaveBeenCalledTimes(1);
    });
  });
});
