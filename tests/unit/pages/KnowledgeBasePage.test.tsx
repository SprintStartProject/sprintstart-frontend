import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

const { mockGetArtifactPage, mockGetArtifactFacets, mockGetArtifactById } = vi.hoisted(() => ({
  mockGetArtifactPage: vi.fn(),
  mockGetArtifactFacets: vi.fn(),
  mockGetArtifactById: vi.fn(),
}));

vi.mock("../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactPage: mockGetArtifactPage,
    getArtifactFacets: mockGetArtifactFacets,
    getArtifactById: mockGetArtifactById,
    getArtifactAiStatus: () => Promise.resolve({ aiAvailable: true, items: [] }),
  },
}));

function setupMockArtifacts(artifacts: Artifact[]) {
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
    isSelectMode,
    onSelectModeChange,
  }: {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedSources?: ReadonlySet<string>;
    onToggleSource?: (source: string) => void;
    onRefresh?: () => void;
    isSelectMode?: boolean;
    onSelectModeChange?: (on: boolean) => void;
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
      {onSelectModeChange && (
        <button data-testid="kb-select-toggle" onClick={() => onSelectModeChange(!isSelectMode)}>
          Select
        </button>
      )}
    </div>
  ),
  ArtifactList: ({
    artifacts,
    selection,
  }: {
    artifacts: Artifact[];
    selection?: { selectedIds: ReadonlySet<string>; onToggle: (id: string) => void };
  }) => (
    <div data-testid="artifact-list">
      {artifacts.map((a) => (
        <div key={a.id} data-testid="artifact-card">
          {selection && (
            <input
              type="checkbox"
              aria-label={`Select ${a.title}`}
              data-testid={`artifact-select-${a.id}`}
              checked={selection.selectedIds.has(a.id)}
              onChange={() => selection.onToggle(a.id)}
            />
          )}
          {a.title}
        </div>
      ))}
    </div>
  ),
  ArtifactBulkActions: ({ selected }: { selected: Artifact[] }) => (
    <div data-testid="bulk-actions">{selected.map((a) => a.id).join(",")}</div>
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

  /*
    While the project list loads, the page falls back to the user's first project and only then
    learns the stored selection. That hop is not a project switch: treating it as one wiped the
    filters of every shared link on arrival.
  */
  it("keeps a shared link's filters while the project context resolves", async () => {
    const { createProjectContextValue, createSelectableProject } =
      await import("../setup/projectContext");
    const project = createSelectableProject({ id: "proj1" });
    mockUseProjectContext.mockReturnValue(
      createProjectContextValue({ projects: [], selectedProjectId: "", isLoading: true }),
    );
    setupMockArtifacts([makeArtifact({ id: "a1", title: "readme.md" })]);

    const view = render(
      <MemoryRouter initialEntries={["/knowledge-base?q=readme&sources=UPLOAD"]}>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    mockUseProjectContext.mockReturnValue(
      createProjectContextValue({
        projects: [project],
        selectedProject: project,
        selectedProjectId: "proj1",
        isLoading: false,
      }),
    );
    view.rerender(
      <MemoryRouter initialEntries={["/knowledge-base?q=readme&sources=UPLOAD"]}>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGetArtifactPage).toHaveBeenCalledWith(
        "proj1",
        expect.objectContaining({ search: "readme", sources: ["UPLOAD"] }),
      );
    });
  });

  it("announces the settled result total in a polite live region", async () => {
    setupMockArtifacts([
      makeArtifact({ id: "a1", title: "readme.md" }),
      makeArtifact({ id: "a2", title: "runbook.md" }),
    ]);

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    const region = screen.getByTestId("kb-results-announcement");
    expect(region).toHaveAttribute("aria-live", "polite");
    await waitFor(() => expect(region).toHaveTextContent("2 artifacts"), { timeout: 3000 });
  });

  it("offers a page size once results outgrow a page, and requests the chosen size", async () => {
    const artifacts = Array.from({ length: 20 }, (_, i) =>
      makeArtifact({ id: `a${i}`, title: `doc-${i}.md` }),
    );
    setupMockArtifacts(artifacts);
    mockGetArtifactPage.mockImplementation((_pid: string, params: { size?: number } = {}) =>
      Promise.resolve({
        items: artifacts,
        page: {
          number: 1,
          size: params.size ?? 20,
          totalElements: 45,
          totalPages: Math.ceil(45 / (params.size ?? 20)),
          hasNext: true,
          hasPrevious: false,
        },
      }),
    );

    render(
      <MemoryRouter>
        <KnowledgeBasePage />
      </MemoryRouter>,
    );

    const select = await screen.findByTestId("kb-page-size");
    fireEvent.change(select, { target: { value: "50" } });

    await waitFor(() => {
      expect(mockGetArtifactPage).toHaveBeenLastCalledWith(
        "proj1",
        expect.objectContaining({ page: 1, size: 50 }),
      );
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

  describe("bulk select", () => {
    const uploads: Artifact[] = [
      makeArtifact({ id: "u1", title: "one.pdf", sourceSystem: "UPLOAD", sourceId: "up-1" }),
      makeArtifact({ id: "g1", title: "gh.md", sourceSystem: "GITHUB" }),
    ];

    function renderAs(group: UserProfile["permissionGroup"]) {
      mockProfileRef.current = { ...mockProfileRef.current, permissionGroup: group };
      setupMockArtifacts(uploads);
      render(
        <MemoryRouter>
          <KnowledgeBasePage />
        </MemoryRouter>,
      );
    }

    afterEach(() => {
      mockProfileRef.current = { ...mockProfileRef.current, permissionGroup: "USER" };
    });

    it("offers no Select toggle to roles that cannot delete uploads", async () => {
      renderAs("USER");
      await waitFor(() => expect(screen.getAllByTestId("artifact-card")).toHaveLength(2));
      expect(screen.queryByTestId("kb-select-toggle")).not.toBeInTheDocument();
    });

    it("lets a PM tick uploads and hands only those to the bulk actions", async () => {
      renderAs("PM");
      await waitFor(() => expect(screen.getAllByTestId("artifact-card")).toHaveLength(2));
      // Keep serving the mixed page after Uploads is picked, to prove the page's own guard.
      const mixedPage: unknown = await mockGetArtifactPage.mock.results[0]?.value;
      mockGetArtifactPage.mockResolvedValue(mixedPage);

      await userEvent.click(screen.getByTestId("kb-filter-upload"));
      await userEvent.click(await screen.findByTestId("kb-select-toggle"));
      await userEvent.click(screen.getByTestId("artifact-select-u1"));
      // A non-upload ticked through the mock list is still filtered out by the page.
      await userEvent.click(screen.getByTestId("artifact-select-g1"));

      expect(screen.getByTestId("bulk-actions")).toHaveTextContent(/^u1$/);
    });

    it("clears the selection on a filter change and on refresh", async () => {
      renderAs("ADMIN");
      await waitFor(() => expect(screen.getAllByTestId("artifact-card")).toHaveLength(2));
      await userEvent.click(screen.getByTestId("kb-filter-upload"));
      await userEvent.click(await screen.findByTestId("kb-select-toggle"));

      await userEvent.click(screen.getByTestId("artifact-select-u1"));
      expect(screen.getByTestId("bulk-actions")).toHaveTextContent("u1");
      await userEvent.type(screen.getByTestId("kb-search-input"), "one");
      await waitFor(() => expect(screen.getByTestId("bulk-actions")).toBeEmptyDOMElement());

      await userEvent.click(await screen.findByTestId("artifact-select-u1"));
      expect(screen.getByTestId("bulk-actions")).toHaveTextContent("u1");
      await userEvent.click(screen.getByTestId("kb-refresh"));
      expect(screen.getByTestId("bulk-actions")).toBeEmptyDOMElement();
    });

    it("offers Select only while Uploads is picked, and unpicking it leaves select mode", async () => {
      renderAs("PM");
      await waitFor(() => expect(screen.getAllByTestId("artifact-card")).toHaveLength(2));
      expect(screen.queryByTestId("kb-select-toggle")).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId("kb-filter-upload"));
      await userEvent.click(await screen.findByTestId("kb-select-toggle"));
      expect(screen.getByTestId("bulk-actions")).toBeInTheDocument();

      await userEvent.click(screen.getByTestId("kb-filter-upload"));
      await waitFor(() => expect(screen.queryByTestId("kb-select-toggle")).not.toBeInTheDocument());
      expect(screen.queryByTestId("bulk-actions")).not.toBeInTheDocument();

      // Re-picking Uploads brings the toggle back, not the old select mode.
      await userEvent.click(screen.getByTestId("kb-filter-upload"));
      await screen.findByTestId("kb-select-toggle");
      expect(screen.queryByTestId("bulk-actions")).not.toBeInTheDocument();
    });
  });
});
