import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBasePage } from "../../../src/pages/KnowledgeBasePage";
import type { Artifact } from "../../../src/features/knowledge-base/types";

vi.mock("../../../src/features/projects/useProjectContext", async () => {
  const { createProjectContextValue, createSelectableProject } =
    await import("../setup/projectContext");
  const project = createSelectableProject({ id: "proj1" });
  return {
    useProjectContext: () =>
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
      }),
  };
});

const { mockProfile } = vi.hoisted(() => ({
  mockProfile: { id: "user1", firstName: "Test", lastName: "User", projectIds: ["p1"] },
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mockProfile }),
}));

const { mockGetUnifiedArtifacts } = vi.hoisted(() => ({
  mockGetUnifiedArtifacts: vi.fn(),
}));

vi.mock("../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getUnifiedArtifacts: mockGetUnifiedArtifacts,
  },
}));

vi.mock("../../../src/features/knowledge-base/components", () => ({
  ArtifactFilters: ({
    searchQuery,
    onSearchChange,
    activeTab,
    onTabChange,
    onRefresh,
  }: {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    activeTab: string;
    onTabChange: (t: string) => void;
    onRefresh?: () => void;
  }) => (
    <div data-testid="artifact-filters">
      <input
        data-testid="kb-search-input"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <button data-testid="kb-tab-uploads" onClick={() => onTabChange("UPLOADS")}>
        Uploads
      </button>
      <button data-testid="kb-refresh" onClick={() => onRefresh?.()}>
        Refresh
      </button>
      <span data-testid="active-tab">{activeTab}</span>
    </div>
  ),
  ArtifactList: ({ artifacts }: { artifacts: Artifact[] }) => (
    <div data-testid="artifact-list">
      {artifacts.map((a) => (
        <div key={a.id} data-testid="artifact-card">
          {a.title}
        </div>
      ))}
    </div>
  ),
  ArtifactViewerDrawer: () => <div data-testid="artifact-viewer">Viewer</div>,
  UploadArtifactModal: () => <div data-testid="upload-modal">Upload Modal</div>,
  CitationsList: () => <div data-testid="citations-list" />,
}));

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "a1",
    title: "readme.md",
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: "src",
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2024-01-01",
    createdAtSource: null,
    updatedAtSource: "2024-01-01",
    contentHash: null,
    ingestionRunId: null,
    ...overrides,
  };
}

describe("KnowledgeBasePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnifiedArtifacts.mockResolvedValue([]);
  });

  it("renders the artifact list after loading artifacts", async () => {
    const artifacts: Artifact[] = [makeArtifact({ id: "a1", title: "readme.md" })];
    mockGetUnifiedArtifacts.mockResolvedValue(artifacts);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
  });

  it("no longer offers uploading here — that moved into the Add source wizard", async () => {
    mockGetUnifiedArtifacts.mockResolvedValue([makeArtifact({ id: "a1", title: "readme.md" })]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Upload new artifact")).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-modal")).not.toBeInTheDocument();
  });

  it("filters artifacts by search query", async () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: "a1", title: "readme.md" }),
      makeArtifact({ id: "a2", title: "contributing.md", sourceId: "src2" }),
    ];
    mockGetUnifiedArtifacts.mockResolvedValue(artifacts);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(2);
    });

    await userEvent.type(screen.getByTestId("kb-search-input"), "readme");

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(1);
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
  });

  it("filters artifacts by tab (UPLOADS)", async () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: "a1", title: "github-file.md", sourceSystem: "GITHUB" }),
      makeArtifact({ id: "a2", title: "uploaded-file.pdf", sourceSystem: "UPLOAD" }),
    ];
    mockGetUnifiedArtifacts.mockResolvedValue(artifacts);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(2);
    });

    await userEvent.click(screen.getByTestId("kb-tab-uploads"));

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(1);
      expect(screen.getByText("uploaded-file.pdf")).toBeInTheDocument();
    });
  });

  it("shows the fetch error banner when getUnifiedArtifacts rejects", async () => {
    mockGetUnifiedArtifacts.mockRejectedValue(new Error("Server down"));

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("kb-fetch-error")).toBeInTheDocument();
    });

    expect(screen.getByText(/Failed to load artifacts/)).toBeInTheDocument();
    expect(screen.getByTestId("kb-retry-fetch")).toBeInTheDocument();
  });

  it("re-fetches when the retry button is clicked after an error", async () => {
    mockGetUnifiedArtifacts.mockRejectedValueOnce(new Error("Server down"));
    mockGetUnifiedArtifacts.mockResolvedValueOnce([
      makeArtifact({ id: "a1", title: "recovered.md" }),
    ]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("kb-fetch-error")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("kb-retry-fetch"));

    await waitFor(() => {
      expect(screen.getByText("recovered.md")).toBeInTheDocument();
    });
  });

  it("re-fetches when the refresh button is clicked", async () => {
    mockGetUnifiedArtifacts.mockResolvedValueOnce([]);
    mockGetUnifiedArtifacts.mockResolvedValueOnce([
      makeArtifact({ id: "a1", title: "after-refresh.md" }),
    ]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("kb-refresh")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId("kb-refresh"));

    await waitFor(() => {
      expect(screen.getByText("after-refresh.md")).toBeInTheDocument();
    });
  });
});
