import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBasePage } from "../../../src/pages/KnowledgeBasePage";
import type { Artifact } from "../../../src/features/knowledge-base/types";
import type { ProjectContextValue } from "../../../src/features/projects/ProjectContext";
import type { UserProfile } from "../../../src/services/types";

const { mockProfileRef, mockUseProjectContext } = vi.hoisted(() => {
  const profile: UserProfile = {
    id: "user1",
    authId: "auth1",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    username: "testuser",
    permissionGroup: "USER",
    projectRoles: [],
    projectIds: ["p1"],
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
  };
  return {
    mockProfileRef: { current: profile },
    mockUseProjectContext: vi.fn<() => ProjectContextValue>(),
  };
});

vi.mock("../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mockUseProjectContext(),
}));

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({ profile: mockProfileRef.current }),
}));

const { mockGetArtifactPage, mockGetArtifactFacets, mockGetArtifactById, mockGetUnifiedArtifacts } =
  vi.hoisted(() => ({
    mockGetArtifactPage: vi.fn(),
    mockGetArtifactFacets: vi.fn(),
    mockGetArtifactById: vi.fn(),
    mockGetUnifiedArtifacts: vi.fn(),
  }));

vi.mock("../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactPage: mockGetArtifactPage,
    getArtifactFacets: mockGetArtifactFacets,
    getArtifactById: mockGetArtifactById,
    getUnifiedArtifacts: mockGetUnifiedArtifacts,
  },
}));

function setupMockArtifacts(artifacts: Artifact[]) {
  mockGetUnifiedArtifacts.mockResolvedValue(artifacts);
  mockGetArtifactPage.mockImplementation(
    (_pid: string, params: { search?: string; sources?: string[] } = {}) => {
      let filtered = artifacts;
      if (params.search) {
        filtered = filtered.filter((a) =>
          (a.title ?? "").toLowerCase().includes(params.search!.toLowerCase()),
        );
      }
      if (params.sources && params.sources.length > 0) {
        filtered = filtered.filter((a) => params.sources!.includes(a.sourceSystem));
      }
      return Promise.resolve({
        items: filtered,
        page: {
          number: 1,
          size: 20,
          totalElements: filtered.length,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
        metadata: {
          pageNumber: 1,
          pageSize: 20,
          totalElements: filtered.length,
          totalPages: 1,
          isFirst: true,
          isLast: true,
          hasNext: false,
          hasPrevious: false,
        },
      });
    },
  );

  mockGetArtifactFacets.mockResolvedValue({
    types: [],
    sources: [],
    formats: [],
    repositories: [],
  });

  mockGetArtifactById.mockImplementation((_pid: string, id: string) => {
    return Promise.resolve(artifacts.find((a) => a.id === id) ?? null);
  });
}

vi.mock("../../../src/features/knowledge-base/components", () => ({
  ArtifactFilters: ({
    searchQuery,
    onSearchChange,
    selectedSources,
    onToggleSource,
    onRefresh,
  }: {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedSources?: ReadonlySet<string>;
    onToggleSource?: (source: string) => void;
    onRefresh?: () => void;
  }) => (
    <div data-testid="artifact-filters">
      <input
        data-testid="kb-search-input"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <button data-testid="kb-filter-upload" onClick={() => onToggleSource?.("UPLOAD")}>
        Uploads
      </button>
      <button data-testid="kb-refresh" onClick={() => onRefresh?.()}>
        Refresh
      </button>
      <span data-testid="active-facets">{[...(selectedSources ?? [])].join(",")}</span>
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
  // Reports which artifact it was handed, so a test can tell "the viewer is mounted" apart
  // from "the viewer is showing the right document".
  ArtifactViewerDrawer: ({ artifact }: { artifact: { id: string } | null }) => (
    <div data-testid="artifact-viewer">{artifact ? artifact.id : "none"}</div>
  ),
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
    lastChangedAt: "2024-01-01",
    contentHash: null,
    ingestionRunId: null,
    ...overrides,
  };
}

describe("KnowledgeBasePage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockArtifacts([]);

    const { createProjectContextValue, createSelectableProject } =
      await import("../setup/projectContext");
    const project = createSelectableProject({ id: "proj1" });
    mockUseProjectContext.mockReturnValue(
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        canManageSelected: true,
        isLoading: false,
      }),
    );
  });

  it("renders the artifact list after loading artifacts", async () => {
    const artifacts: Artifact[] = [makeArtifact({ id: "a1", title: "readme.md" })];
    setupMockArtifacts(artifacts);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
  });

  /*
    The dashboard's knowledge-base card links to a document, not just to this page. Every row
    there used to land on the bare page and the reader had to find the document again.
  */
  it("opens the artifact named in the URL", async () => {
    setupMockArtifacts([
      makeArtifact({ id: "a1", title: "readme.md" }),
      makeArtifact({ id: "a2", title: "runbook.md" }),
    ]);

    render(
      <MemoryRouter initialEntries={["/knowledge-base?artifact=a2"]}>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("artifact-viewer")).toHaveTextContent("a2");
    });
  });

  it("opens no artifact without the parameter", async () => {
    setupMockArtifacts([makeArtifact({ id: "a1", title: "readme.md" })]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("artifact-viewer")).toHaveTextContent("none");
    });
  });

  it("shows loading spinner when project context is loading", async () => {
    const { createProjectContextValue } = await import("../setup/projectContext");
    mockUseProjectContext.mockReturnValue(
      createProjectContextValue({
        projects: [],
        selectedProject: null,
        selectedProjectId: "",
        isLoading: true,
      }),
    );

    const { container } = render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    // The skeleton only appears after a short delay, so it never flashes on a fast load.
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });
    expect(screen.queryByText("No project available")).not.toBeInTheDocument();
  });

  it("no longer offers uploading here — that moved into the Add source wizard", async () => {
    setupMockArtifacts([makeArtifact({ id: "a1", title: "readme.md" })]);

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
    setupMockArtifacts(artifacts);

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

  it("filters artifacts by source", async () => {
    const artifacts: Artifact[] = [
      makeArtifact({ id: "a1", title: "github-file.md", sourceSystem: "GITHUB" }),
      makeArtifact({ id: "a2", title: "uploaded-file.pdf", sourceSystem: "UPLOAD" }),
    ];
    setupMockArtifacts(artifacts);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(2);
    });

    await userEvent.click(screen.getByTestId("kb-filter-upload"));

    await waitFor(() => {
      expect(screen.getAllByTestId("artifact-card")).toHaveLength(1);
      expect(screen.getByText("uploaded-file.pdf")).toBeInTheDocument();
    });
  });

  it("shows the fetch error banner when getArtifactPage rejects", async () => {
    mockGetArtifactPage.mockRejectedValue(new Error("Server down"));

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
    mockGetArtifactPage.mockRejectedValueOnce(new Error("Server down"));
    setupMockArtifacts([makeArtifact({ id: "a1", title: "recovered.md" })]);

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
    setupMockArtifacts([]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("kb-refresh")).toBeInTheDocument();
    });

    setupMockArtifacts([makeArtifact({ id: "a1", title: "after-refresh.md" })]);

    await userEvent.click(screen.getByTestId("kb-refresh"));

    await waitFor(() => {
      expect(screen.getByText("after-refresh.md")).toBeInTheDocument();
    });
  });
});
