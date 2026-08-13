import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitBranch, Database } from "lucide-react";
import { SourceList } from "../../../../../src/features/data-ingestion/components/SourceList";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";
import type { DataSource } from "../../../../../src/features/data-ingestion/types";

function createMockSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    sourceId: "source-github",
    sourceSystem: "GITHUB",
    name: "GitHub Repository",
    type: "GitHub",
    icon: GitBranch,
    status: "connected",
    statusLabel: "Synced",
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
    runIds: [],
    sharesSourceSystem: false,
    lastCommitsSyncAt: null,
    lastIssuesSyncAt: null,
    lastPullRequestsSyncAt: null,
    lastRunAt: "2026-07-05T10:00:00Z",
    failedItems: [],
    githubRepository: null,
    description: "Indexes repositories, README files, pull requests.",
    ...overrides,
  };
}

describe("SourceList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders source cards for each source", () => {
    const sources: DataSource[] = [
      createMockSource({
        sourceSystem: "GITHUB",
        name: "GitHub Repository",
        type: "GitHub",
      }),
      createMockSource({
        sourceSystem: "JIRA",
        name: "Jira Project Board",
        type: "Jira",
        icon: Database,
      }),
    ];

    render(<SourceList sources={sources} selectedSourceId={null} onSelectSource={vi.fn()} />);

    expect(screen.getByText("GitHub Repository")).toBeInTheDocument();
    expect(screen.getByText("Jira Project Board")).toBeInTheDocument();
    expect(screen.getAllByText("GitHub").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jira").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
  });

  it("shows the Jira instance domain without the scheme under the name", () => {
    const sources: DataSource[] = [
      createMockSource({
        sourceId: "https://acme.atlassian.net",
        sourceSystem: "JIRA",
        name: "Jira Project Board",
        type: "Jira",
        icon: Database,
        githubRepository: null,
        jiraInstance: {
          instanceUrl: "https://acme.atlassian.net",
          displayName: "Jira Project Board",
          credentialName: "cred",
          credentialUserEmail: "user@example.com",
        },
      }),
    ];

    render(<SourceList sources={sources} selectedSourceId={null} onSelectSource={vi.fn()} />);

    expect(screen.getByText("acme.atlassian.net")).toBeInTheDocument();
    expect(screen.queryByText("https://acme.atlassian.net")).not.toBeInTheDocument();
  });

  it("renders info blocks with formatted values", () => {
    const sources: DataSource[] = [
      createMockSource({
        latestIngestedCount: 42,
        totalArtifactCount: 42,
        latestUpdatedCount: 7,
        lastSync: "2026-07-05",
        errors: 3,
      }),
    ];

    render(<SourceList sources={sources} selectedSourceId={null} onSelectSource={vi.fn()} />);

    expect(screen.getByText("Artifacts Ingested")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Latest Updated")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Last Sync")).toBeInTheDocument();
    expect(screen.getByText("2026-07-05")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onSelectSource with the source system when a card is clicked", async () => {
    const user = userEvent.setup();
    const onSelectSource = vi.fn();
    const sources: DataSource[] = [
      createMockSource({ sourceSystem: "GITHUB", name: "GitHub Repository" }),
      createMockSource({
        sourceId: "source-jira",
        sourceSystem: "JIRA",
        name: "Jira Project Board",
        icon: Database,
      }),
    ];

    render(
      <SourceList sources={sources} selectedSourceId={null} onSelectSource={onSelectSource} />,
    );

    await user.click(screen.getByText("Jira Project Board"));

    expect(onSelectSource).toHaveBeenCalledWith("source-jira");
    expect(onSelectSource).toHaveBeenCalledTimes(1);
  });

  it("highlights the selected source card", () => {
    const sources: DataSource[] = [
      createMockSource({ sourceSystem: "GITHUB", name: "GitHub Repository" }),
      createMockSource({
        sourceId: "source-jira",
        sourceSystem: "JIRA",
        name: "Jira Project Board",
        icon: Database,
      }),
    ];

    render(
      <SourceList sources={sources} selectedSourceId="source-jira" onSelectSource={vi.fn()} />,
    );

    const jiraButton = screen.getByText("Jira Project Board").closest("button");
    const githubButton = screen.getByText("GitHub Repository").closest("button");

    expect(jiraButton).toHaveClass("border-app-brand");
    expect(githubButton).not.toHaveClass("border-app-brand");
  });

  it("renders the empty state when no sources are connected", () => {
    render(<SourceList sources={[]} selectedSourceId={null} onSelectSource={vi.fn()} />);

    expect(screen.getByText("Connect your first source")).toBeInTheDocument();
  });

  it("offers an add-source call to action in the empty state", async () => {
    const user = userEvent.setup();
    const onAddSource = vi.fn();

    render(
      <SourceList
        sources={[]}
        selectedSourceId={null}
        onSelectSource={vi.fn()}
        onAddSource={onAddSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add sources/i }));
    expect(onAddSource).toHaveBeenCalledTimes(1);
  });

  it("renders a failed items warning when a source has failed items", () => {
    const sources: DataSource[] = [
      createMockSource({
        sourceSystem: "GITHUB",
        failedItems: [
          { artifactIdentifier: "FILE: broken.md", reason: "Parse error" },
          { artifactIdentifier: "FILE: missing.md", reason: "Not found" },
        ],
      }),
    ];

    render(<SourceList sources={sources} selectedSourceId={null} onSelectSource={vi.fn()} />);

    expect(screen.getByText(/2 failed items in latest status/)).toBeInTheDocument();
  });
});
