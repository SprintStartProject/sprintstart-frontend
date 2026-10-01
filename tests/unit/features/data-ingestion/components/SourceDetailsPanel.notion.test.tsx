import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotebookText } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../../src/context/ToastProvider";
import { SourceDetailsPanel } from "../../../../../src/features/data-ingestion/components/SourceDetailsPanel";
import type { DataSource } from "../../../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: ToastProvider });

const PAGE_URL = "https://www.notion.so/Sprint-Planning-page1";

const notionSource: DataSource = {
  sourceId: "conn-1",
  sourceSystem: "NOTION",
  name: "Sprint Planning",
  type: "Notion",
  icon: NotebookText,
  status: "connected",
  backendStatus: "CONNECTED",
  statusLabel: "Connected",
  ingestionStatus: "connected",
  ingestionStatusLabel: "Synced",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 4,
  lastSync: "2026-07-05",
  errors: 0,
  latestIngestedCount: 4,
  latestUpdatedCount: 0,
  totalArtifactCount: 4,
  deletedCount: 0,
  runIds: [],
  sharesSourceSystem: false,
  lastCommitsSyncAt: null,
  lastIssuesSyncAt: null,
  lastPullRequestsSyncAt: null,
  lastRunAt: "2026-07-05T10:00:00Z",
  failedItems: [],
  githubRepository: null,
  notionPage: {
    connectionId: "conn-1",
    pageId: "page-1",
    pageUrl: PAGE_URL,
    credentialName: "wiki",
    lastSyncedAt: "2026-07-05T10:00:00Z",
  },
};

describe("SourceDetailsPanel, Notion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the page section with title, link and credential instead of repository rows", () => {
    render(<SourceDetailsPanel source={notionSource} onClose={vi.fn()} />);

    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.queryByText("Repository")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sprint Planning").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open in Notion" })).toHaveAttribute("href", PAGE_URL);
    expect(screen.getByText("wiki")).toBeInTheDocument();
    expect(screen.getByText("Last synced")).toBeInTheDocument();
  });

  it("updates the page via the Update page button without a second toast", async () => {
    const user = userEvent.setup();
    const onUpdateSource = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={notionSource}
        onUpdateSource={onUpdateSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /update page/i }));

    await waitFor(() => expect(onUpdateSource).toHaveBeenCalledWith(notionSource));
    // The sync hook reports the outcome itself; the drawer must not add "Update started".
    expect(screen.queryByText("Update started")).not.toBeInTheDocument();
  });

  it("does not report an error twice when the update fails", async () => {
    const user = userEvent.setup();
    const onUpdateSource = vi.fn().mockRejectedValue(new Error("Notion unreachable"));

    render(
      <SourceDetailsPanel
        source={notionSource}
        onUpdateSource={onUpdateSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /update page/i }));

    await waitFor(() => expect(onUpdateSource).toHaveBeenCalled());
    expect(screen.queryByText("Notion unreachable")).not.toBeInTheDocument();
  });

  it("disables the update when the page has no connection id", () => {
    render(
      <SourceDetailsPanel
        source={{
          ...notionSource,
          notionPage: { ...notionSource.notionPage!, connectionId: "" },
        }}
        onUpdateSource={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /update page/i })).toBeDisabled();
  });

  it("toggles ingestion by page URL via onSetNotionSourceEnabled", async () => {
    const user = userEvent.setup();
    const onSetNotionSourceEnabled = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={notionSource}
        canManageSyncSettings
        onSetNotionSourceEnabled={onSetNotionSourceEnabled}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("switch", { name: /Toggle ingestion for Sprint Planning/ }));

    expect(onSetNotionSourceEnabled).toHaveBeenCalledWith(PAGE_URL, false);
  });

  it("shows a disabled page as read-only text without the manage rights", () => {
    render(
      <SourceDetailsPanel
        source={{ ...notionSource, backendStatus: "DISABLED" }}
        onSetNotionSourceEnabled={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("removes the page after confirmation and says the ingested content stays", async () => {
    const user = userEvent.setup();
    const onUnlinkSource = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={notionSource}
        onUnlinkSource={onUnlinkSource}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Remove this page from the current project/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove from project/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/stays in the knowledge base/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^remove$/i }));

    await waitFor(() => expect(onUnlinkSource).toHaveBeenCalledWith(notionSource));
  });

  it("offers no removal without onUnlinkSource", () => {
    render(<SourceDetailsPanel source={notionSource} onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /remove from project/i })).not.toBeInTheDocument();
  });
  describe("sync schedule", () => {
    const schedule = {
      autoUpdate: true,
      spec: { type: "INTERVAL", everyMinutes: 30 },
      nextSyncAt: null,
    };

    it("loads the schedule for the page's connection", async () => {
      const onLoadNotionConfig = vi.fn().mockResolvedValue(schedule);

      render(
        <SourceDetailsPanel
          source={notionSource}
          canManageSyncSettings
          onLoadNotionConfig={onLoadNotionConfig}
          onSaveNotionConfig={vi.fn().mockResolvedValue(undefined)}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText("Sync Schedule")).toBeInTheDocument();
      await waitFor(() => expect(onLoadNotionConfig).toHaveBeenCalledWith("conn-1"));
      expect(await screen.findByLabelText("Minutes")).toHaveValue(30);
      expect(
        screen.getByRole("switch", { name: "Toggle Notion page auto update" }),
      ).toBeInTheDocument();
    });

    it("saves the schedule against the connection id", async () => {
      const user = userEvent.setup();
      const onSaveNotionConfig = vi.fn().mockResolvedValue(undefined);

      render(
        <SourceDetailsPanel
          source={notionSource}
          canManageSyncSettings
          onLoadNotionConfig={vi.fn().mockResolvedValue(schedule)}
          onSaveNotionConfig={onSaveNotionConfig}
          onClose={vi.fn()}
        />,
      );

      const minutes = await screen.findByLabelText("Minutes");
      await user.clear(minutes);
      await user.type(minutes, "45");
      await user.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() =>
        expect(onSaveNotionConfig).toHaveBeenCalledWith(
          "conn-1",
          expect.objectContaining({
            autoUpdate: true,
            schedule: { type: "INTERVAL", everyMinutes: 45 },
          }),
        ),
      );
    });

    it("hides the schedule without the manage rights or without the handlers", () => {
      const { rerender } = render(
        <SourceDetailsPanel
          source={notionSource}
          onLoadNotionConfig={vi.fn()}
          onSaveNotionConfig={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByText("Sync Schedule")).not.toBeInTheDocument();

      rerender(
        <SourceDetailsPanel source={notionSource} canManageSyncSettings onClose={vi.fn()} />,
      );
      expect(screen.queryByText("Sync Schedule")).not.toBeInTheDocument();
    });
  });
});
