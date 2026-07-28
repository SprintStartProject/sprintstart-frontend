import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitBranch } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SourceDetailsPanel } from "../../../../../src/features/data-ingestion/components/SourceDetailsPanel";
import type {
  DataSource,
  GithubRepositoryDetails,
} from "../../../../../src/features/data-ingestion/types";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";

const githubRepository: GithubRepositoryDetails = {
  owner: "acme",
  name: "monorepo",
  repositoryId: "repo-1",
  fullName: "acme/monorepo",
  url: "https://github.com/acme/monorepo",
  enabled: true,
};

const mockSource: DataSource = {
  sourceId: "source-github",
  sourceSystem: "GITHUB",
  name: "GitHub Repository",
  type: "GitHub",
  icon: GitBranch,
  status: "connected",
  statusLabel: "Connected",
  ingestionStatus: "connected",
  ingestionStatusLabel: "Synced",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 10,
  lastSync: "2026-07-05",
  errors: 0,
  latestIngestedCount: 10,
  latestUpdatedCount: 3,
  totalArtifactCount: 10,
  deletedCount: 0,
  runIds: ["run-1"],
  sharesSourceSystem: false,
  lastCommitsSyncAt: null,
  lastIssuesSyncAt: null,
  lastPullRequestsSyncAt: null,
  lastRunAt: "2026-07-05T10:00:00Z",
  failedItems: [],
  githubRepository,
  description: "Indexes repositories.",
};

const jiraSource: DataSource = {
  ...mockSource,
  sourceId: "https://acme.atlassian.net",
  sourceSystem: "JIRA",
  name: "Team board",
  type: "Jira",
  githubRepository: null,
  jiraInstance: {
    instanceUrl: "https://acme.atlassian.net",
    displayName: "Team board",
    credentialName: "default",
    credentialUserEmail: "jira@corp.com",
  },
};

describe("SourceDetailsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Jira instance section instead of a repository section", () => {
    render(<SourceDetailsPanel source={jiraSource} onClose={vi.fn()} />);

    expect(screen.getByText("Instance")).toBeInTheDocument();
    expect(screen.queryByText("Repository")).not.toBeInTheDocument();
    expect(screen.getByText("https://acme.atlassian.net")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("jira@corp.com")).toBeInTheDocument();
  });

  it('updates a Jira instance via the "Update instance" button', async () => {
    const user = userEvent.setup();
    const onUpdateSource = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={jiraSource}
        onUpdateSource={onUpdateSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Update instance/ }));

    expect(onUpdateSource).toHaveBeenCalledWith(jiraSource);
  });

  it("renders repository and ingestion details", () => {
    render(<SourceDetailsPanel source={mockSource} onClose={vi.fn()} />);

    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("acme/monorepo")).toBeInTheDocument();
    expect(screen.getByText("Ingestion")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("calls onUpdateSource with the selected source", async () => {
    const user = userEvent.setup();
    const onUpdateSource = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={mockSource}
        onUpdateSource={onUpdateSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Update repo/ }));

    expect(onUpdateSource).toHaveBeenCalledWith(mockSource);
    await waitFor(() => {
      expect(
        screen.getByText(
          "Update started. Details will refresh while ingestion runs.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("calls onRefreshDetails when the refresh button is clicked", async () => {
    const user = userEvent.setup();
    const onRefreshDetails = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={mockSource}
        onRefreshDetails={onRefreshDetails}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Refresh details/ }));

    expect(onRefreshDetails).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByText("Repository details refreshed."),
      ).toBeInTheDocument();
    });
  });

  it("disables repository updates when repository details are unavailable", () => {
    render(
      <SourceDetailsPanel
        source={{ ...mockSource, githubRepository: null }}
        onUpdateSource={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Update repo/ })).toBeDisabled();
  });

  it("does not show the remove-from-project action without onUnlinkSource", () => {
    render(<SourceDetailsPanel source={mockSource} onClose={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: /Remove from project/ }),
    ).not.toBeInTheDocument();
  });

  it("unlinks the source after confirming the dialog", async () => {
    const user = userEvent.setup();
    const onUnlinkSource = vi.fn().mockResolvedValue(undefined);

    render(
      <SourceDetailsPanel
        source={mockSource}
        onUnlinkSource={onUnlinkSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Remove from project/ }),
    );

    // The confirmation dialog gates the destructive call.
    expect(onUnlinkSource).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: /Remove repository from project/,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Remove$/ }));

    expect(onUnlinkSource).toHaveBeenCalledWith(mockSource);
  });

  it("surfaces the error message when unlinking fails", async () => {
    const user = userEvent.setup();
    const onUnlinkSource = vi
      .fn()
      .mockRejectedValue(new Error("You cannot access this project."));

    render(
      <SourceDetailsPanel
        source={mockSource}
        onUnlinkSource={onUnlinkSource}
        onClose={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Remove from project/ }),
    );
    await user.click(screen.getByRole("button", { name: /^Remove$/ }));

    await waitFor(() => {
      expect(
        screen.getByText("You cannot access this project."),
      ).toBeInTheDocument();
    });
  });

  it("hides the remove-from-project action when the repository has no id", () => {
    render(
      <SourceDetailsPanel
        source={{
          ...mockSource,
          githubRepository: { ...githubRepository, repositoryId: null },
        }}
        onUnlinkSource={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Remove from project/ }),
    ).not.toBeInTheDocument();
  });

  it("renders failed items from the source", () => {
    render(
      <SourceDetailsPanel
        source={{
          ...mockSource,
          errors: 1,
          failedItems: [
            {
              artifactIdentifier: "FILE: broken.md",
              reason: "Parse error",
            },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Failed Items")).toBeInTheDocument();
    expect(screen.getByText("FILE: broken.md")).toBeInTheDocument();
    expect(screen.getByText("Parse error")).toBeInTheDocument();
  });
});
