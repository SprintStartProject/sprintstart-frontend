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

    expect(screen.getAllByText("GitHub Repository").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jira Project Board").length).toBeGreaterThan(0);
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

    expect(screen.getAllByText("acme.atlassian.net").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("https://acme.atlassian.net")).toHaveLength(0);
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

    // Mobile card: inline metrics
    expect(screen.getByText("artifacts")).toBeInTheDocument();
    expect(screen.getByText("updated")).toBeInTheDocument();
    expect(screen.getByText("errors")).toBeInTheDocument();
    expect(screen.getByText("Last synced")).toBeInTheDocument();
    // Desktop card: original 2x2 stat grid
    expect(screen.getByText("Artifacts Ingested")).toBeInTheDocument();
    expect(screen.getByText("Latest Updated")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
    expect(screen.getByText("Last Sync")).toBeInTheDocument();
    // Values appear in both layouts
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-07-05").length).toBeGreaterThan(0);
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

    await user.click(screen.getAllByText("Jira Project Board")[0]);

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

    const jiraButton = screen.getAllByText("Jira Project Board")[0].closest("button");
    const githubButton = screen.getAllByText("GitHub Repository")[0].closest("button");

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

    expect(screen.getAllByText(/2 failed items in latest status/).length).toBeGreaterThan(0);
  });
});
