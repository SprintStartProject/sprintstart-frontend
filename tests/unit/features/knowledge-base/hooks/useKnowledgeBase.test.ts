import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useKnowledgeBase } from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type {
  Artifact,
  ArtifactPage,
  KnowledgeListParams,
} from "../../../../../src/features/knowledge-base/types";
import { matchesFormat } from "../../../../../src/features/knowledge-base/tabs";
import {
  getArtifactRepository,
  matchesRepository,
} from "../../../../../src/features/knowledge-base/githubMetadata";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getArtifactPage: vi.fn(),
    getArtifactFacets: vi.fn(),
    getUnifiedArtifacts: vi.fn(),
  },
}));

function makeArtifact(
  id: string,
  title: string,
  artifactType: Artifact["artifactType"] = "FILE",
  metadata?: string,
): Artifact {
  return {
    id,
    title,
    artifactType,
    sourceSystem: "GITHUB",
    sourceId: "src",
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2024-01-01",
    lastChangedAt: "2024-01-01",
    contentHash: null,
    ingestionRunId: null,
    ...(metadata !== undefined ? { metadata } : {}),
  };
}

/** One artifact per source, for the union/AND assertions. */
function makeFacetFixture(): Artifact[] {
  return [
    { ...makeArtifact("gh-pr", "Add feature", "PULL_REQUEST"), sourceSystem: "GITHUB" },
    { ...makeArtifact("gh-issue", "Bug report", "ISSUE"), sourceSystem: "GITHUB" },
    { ...makeArtifact("jira-issue", "Task ticket", "ISSUE"), sourceSystem: "JIRA" },
    { ...makeArtifact("conf-page", "Onboarding Runbook", "PAGE"), sourceSystem: "CONFLUENCE" },
    {
      ...makeArtifact("up-pdf", "manual.pdf", "FILE"),
      sourceSystem: "UPLOAD",
      mime: "application/pdf",
    },
  ];
}

/** Two repos' GitHub artifacts plus out-of-scope kinds, for the repository facet. */
function makeRepoFixture(): Artifact[] {
  const repoMetadata = (repository: string) =>
    JSON.stringify({ repositoryId: "r1", repositoryFullName: repository });

  return [
    {
      ...makeArtifact(
        "gh-fe-1",
        "Frontend fix",
        "PULL_REQUEST",
        repoMetadata("sprintstart/sprintstart-frontend"),
      ),
      sourceSystem: "GITHUB",
    },
    {
      ...makeArtifact(
        "gh-fe-2",
        "Frontend chore",
        "FILE",
        repoMetadata("sprintstart/sprintstart-frontend"),
      ),
      sourceSystem: "GITHUB",
    },
    {
      ...makeArtifact(
        "gh-be-1",
        "Backend fix",
        "COMMIT",
        repoMetadata("sprintstart/sprintstart-backend"),
      ),
      sourceSystem: "GITHUB",
    },
    {
      ...makeArtifact(
        "gh-org",
        "SprintStart",
        "ORG_METADATA",
        JSON.stringify({ login: "sprintstart", members: [] }),
      ),
      sourceSystem: "GITHUB",
    },
    {
      ...makeArtifact(
        "gh-org-other",
        "Unrelated Org",
        "ORG_METADATA",
        JSON.stringify({ login: "unrelated-org", members: [] }),
      ),
      sourceSystem: "GITHUB",
    },
    {
      ...makeArtifact("up-pdf", "manual.pdf", "FILE"),
      sourceSystem: "UPLOAD",
      mime: "application/pdf",
    },
  ];
}

function mockArtifactQuery(artifacts: Artifact[]) {
  const getArtifactPage = vi
    .fn()
    .mockImplementation((_pid: string, params: KnowledgeListParams = {}) => {
      const filtered = artifacts.filter((a) => {
        if (params.search) {
          const q = params.search.toLowerCase();
          const text = [a.title ?? "", a.sourceId, a.sourceUrl ?? ""].join(" ").toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (params.types && params.types.length > 0) {
          if (!params.types.includes(a.artifactType)) return false;
        }
        if (params.sources && params.sources.length > 0) {
          if (!params.sources.includes(a.sourceSystem)) return false;
        }
        if (params.format) {
          if (!matchesFormat(a, params.format)) return false;
        }
        if (params.repositories && params.repositories.length > 0) {
          if (!matchesRepository(a, new Set(params.repositories))) return false;
        }
        return true;
      });

      const page = params.page ?? 1;
      const size = params.size ?? 20;
      const totalElements = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalElements / size));
      const start = (page - 1) * size;
      const items = filtered.slice(start, start + size);

      return Promise.resolve({
        items,
        metadata: {
          pageNumber: page,
          pageSize: size,
          totalElements,
          totalPages,
          isFirst: page === 1,
          isLast: page === totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      });
    });

  const getArtifactFacets = vi
    .fn()
    .mockImplementation((_pid: string, params: KnowledgeListParams = {}) => {
      const matchesAllExcept = (
        a: Artifact,
        excludeFacet: "types" | "sources" | "format" | "repositories",
      ) => {
        if (params.search) {
          const q = params.search.toLowerCase();
          const text = [a.title ?? "", a.sourceId, a.sourceUrl ?? ""].join(" ").toLowerCase();
          if (!text.includes(q)) return false;
        }
        if (excludeFacet !== "types" && params.types && params.types.length > 0) {
          if (!params.types.includes(a.artifactType)) return false;
        }
        if (excludeFacet !== "sources" && params.sources && params.sources.length > 0) {
          if (!params.sources.includes(a.sourceSystem)) return false;
        }
        if (excludeFacet !== "format" && params.format) {
          if (!matchesFormat(a, params.format)) return false;
        }
        if (
          excludeFacet !== "repositories" &&
          params.repositories &&
          params.repositories.length > 0
        ) {
          if (!matchesRepository(a, new Set(params.repositories))) return false;
        }
        return true;
      };

      const typeCandidates = artifacts.filter((a) => matchesAllExcept(a, "types"));
      const typeCounts = new Map<string, number>();
      for (const a of typeCandidates) {
        typeCounts.set(a.artifactType, (typeCounts.get(a.artifactType) ?? 0) + 1);
      }
      const types = Array.from(typeCounts.entries()).map(([value, count]) => ({ value, count }));

      const presentSources = new Set(artifacts.map((a) => a.sourceSystem));
      const sourceCandidates = artifacts.filter((a) => matchesAllExcept(a, "sources"));
      const sourceCounts = new Map<string, number>();
      for (const s of presentSources) {
        sourceCounts.set(s, 0);
      }
      for (const a of sourceCandidates) {
        sourceCounts.set(a.sourceSystem, (sourceCounts.get(a.sourceSystem) ?? 0) + 1);
      }
      const sources = Array.from(sourceCounts.entries()).map(([value, count]) => ({
        value,
        count,
      }));

      const formatCandidates = artifacts.filter((a) => matchesAllExcept(a, "format"));
      const formatCounts = new Map<string, number>();
      for (const a of formatCandidates) {
        for (const fmt of ["PDF", "MARKDOWN", "IMAGE", "OTHER"] as const) {
          if (matchesFormat(a, fmt)) {
            formatCounts.set(fmt, (formatCounts.get(fmt) ?? 0) + 1);
          }
        }
      }
      const formats = Array.from(formatCounts.entries()).map(([value, count]) => ({
        value,
        count,
      }));

      const repoCandidates = artifacts.filter(
        (a) => matchesAllExcept(a, "repositories") && a.sourceSystem === "GITHUB",
      );
      const distinctRepos = new Set<string>();
      for (const a of repoCandidates) {
        const repo = getArtifactRepository(a);
        if (repo) distinctRepos.add(repo);
      }
      const repositories = Array.from(distinctRepos).map((repo) => ({
        value: repo,
        count: repoCandidates.filter((a) => matchesRepository(a, new Set([repo]))).length,
      }));

      return Promise.resolve({ types, sources, formats, repositories });
    });

  return { getArtifactPage, getArtifactFacets };
}

/** Renders the hook against a fixed artifact list and waits for the fetch to land. */
async function renderWith(artifacts: Artifact[]) {
  const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
  const { getArtifactPage, getArtifactFacets } = mockArtifactQuery(artifacts);
  vi.mocked(knowledgeService.getArtifactPage).mockImplementation(getArtifactPage);
  vi.mocked(knowledgeService.getArtifactFacets).mockImplementation(getArtifactFacets);

  const { result } = renderHook(() => useKnowledgeBase("proj-1"));

  await waitFor(() => {
    if (artifacts.length > 0) {
      expect(result.current.artifacts.length).toBeGreaterThan(0);
    } else {
      expect(result.current.isLoading).toBe(false);
    }
  });

  return result;
}

describe("useKnowledgeBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads artifacts on mount", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const { getArtifactPage, getArtifactFacets } = mockArtifactQuery([
      makeArtifact("a1", "first.md"),
    ]);
    vi.mocked(knowledgeService.getArtifactPage).mockImplementation(getArtifactPage);
    vi.mocked(knowledgeService.getArtifactFacets).mockImplementation(getArtifactFacets);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchError).toBeNull();
  });

  it("a newer fetch overwrites a stale one, not the other way around", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const mockFn = vi.mocked(knowledgeService.getArtifactPage);

    const makePage = (title: string): ArtifactPage => ({
      items: [makeArtifact("a", title)],
      metadata: {
        pageNumber: 1,
        pageSize: 20,
        totalElements: 1,
        totalPages: 1,
        isFirst: true,
        isLast: true,
        hasNext: false,
        hasPrevious: false,
      },
    });

    let resolveFirst: (value: ArtifactPage) => void = () => {};
    const firstPromise = new Promise<ArtifactPage>((resolve) => {
      resolveFirst = resolve;
    });

    mockFn.mockReturnValueOnce(firstPromise);
    mockFn.mockResolvedValueOnce(makePage("newer.md"));

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await act(async () => {
      void result.current.fetchArtifacts();
      await waitFor(() => {
        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
      expect(result.current.artifacts[0].title).toBe("newer.md");
    });

    await act(async () => {
      resolveFirst(makePage("stale.md"));
      await Promise.resolve();
    });

    expect(result.current.artifacts[0].title).toBe("newer.md");
  });

  it("sets fetchError when the fetch rejects", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getArtifactPage).mockRejectedValue(new Error("Server down"));

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.fetchError).not.toBeNull();
    });

    expect(result.current.fetchError).toContain("Failed to load artifacts");
    expect(result.current.isLoading).toBe(false);
  });

  it("filters by search query", async () => {
    const result = await renderWith([
      makeArtifact("a1", "readme.md"),
      makeArtifact("a2", "contributing.md"),
    ]);

    act(() => {
      result.current.handleSearchChange("readme");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts).toHaveLength(1);
      expect(result.current.filteredArtifacts[0].title).toBe("readme.md");
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("resets to page 1 when search changes", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    expect(result.current.totalPages).toBe(2);

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
    });

    act(() => {
      result.current.handleSearchChange("file-0");
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("narrows to a single source", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts).toHaveLength(1);
      expect(result.current.filteredArtifacts[0].sourceSystem).toBe("UPLOAD");
      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  it("unions several sources instead of replacing the last one", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("JIRA");
    });

    await waitFor(() => {
      expect(result.current.selectedSources.size).toBe(2);
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-issue",
        "gh-pr",
        "jira-issue",
      ]);
    });
  });

  it("ANDs the tab filter with the source facet", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.handleTabChange("PULL_REQUEST");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts).toHaveLength(1);
      expect(result.current.filteredArtifacts[0].id).toBe("gh-pr");
    });
  });

  it("matches one type across every source, so Issues covers GitHub and Jira alike", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.handleTabChange("ISSUE");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-issue",
        "jira-issue",
      ]);
      const tabValues = result.current.tabOptions.map((option) => option.value);
      expect(tabValues).toContain("ISSUE");
      expect(tabValues).toContain("ALL");
    });
  });

  it("offers the file-format facet only while Uploads is selected", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.formatOptions).toHaveLength(0);

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    await waitFor(() => {
      // The fixture holds one PDF upload, so that is the only format worth offering.
      expect(result.current.formatOptions.map((option) => option.value)).toEqual(["PDF"]);
    });
  });

  it("narrows only the uploads when a format is chosen", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleFormat("PDF");
    });

    await waitFor(() => {
      // The format facet describes uploads; it must not hide the GitHub artifacts.
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-issue",
        "gh-pr",
        "up-pdf",
      ]);
    });
  });

  it("clears the format selection when Uploads is deselected", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleFormat("PDF");
    });
    await waitFor(() => {
      expect(result.current.selectedFormat).toBe("PDF");
    });

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    await waitFor(() => {
      expect(result.current.selectedFormat).toBeNull();
      expect(result.current.formatOptions).toHaveLength(0);
      expect(result.current.filteredArtifacts).toHaveLength(5);
    });
  });

  it("offers the repository facet only while GitHub is selected", async () => {
    const result = await renderWith(makeRepoFixture());

    expect(result.current.repositoryOptions).toHaveLength(0);

    act(() => {
      result.current.toggleSource("GITHUB");
    });

    await waitFor(() => {
      expect(result.current.repositoryOptions.map((option) => option.value)).toEqual([
        "sprintstart/sprintstart-backend",
        "sprintstart/sprintstart-frontend",
      ]);
      expect(
        result.current.repositoryOptions.find(
          (option) => option.value === "sprintstart/sprintstart-frontend",
        )?.count,
      ).toBe(3);
    });
  });

  it("promises with its count exactly what choosing the repository delivers", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
    });

    let frontendCount = 0;
    await waitFor(() => {
      const frontend = result.current.repositoryOptions.find(
        (option) => option.value === "sprintstart/sprintstart-frontend",
      );
      expect(frontend?.count).toBe(3);
      frontendCount = frontend?.count ?? 0;
    });

    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-frontend");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts).toHaveLength(frontendCount);
    });
  });

  it("narrows only the github artifacts when a repository is chosen", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-frontend");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-fe-1",
        "gh-fe-2",
        "gh-org",
        "up-pdf",
      ]);
    });
  });

  it("shows the owning org profile under a checked repository, never an unrelated one", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
    });
    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-backend");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-be-1",
        "gh-org",
      ]);
    });
  });

  it("unions several repositories instead of replacing the choice", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
    });
    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-frontend");
      result.current.toggleRepository("sprintstart/sprintstart-backend");
    });

    await waitFor(() => {
      expect(result.current.selectedRepositories.size).toBe(2);
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-be-1",
        "gh-fe-1",
        "gh-fe-2",
        "gh-org",
      ]);
    });
  });

  it("clears the repository selection when GitHub is deselected", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
    });
    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-frontend");
    });
    await waitFor(() => {
      expect(result.current.selectedRepositories.size).toBe(1);
    });

    act(() => {
      result.current.toggleSource("GITHUB");
    });

    await waitFor(() => {
      expect(result.current.selectedRepositories.size).toBe(0);
      expect(result.current.repositoryOptions).toHaveLength(0);
      expect(result.current.filteredArtifacts).toHaveLength(6);
    });
  });

  it("counts each option against the other facets, not just the search", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.sourceOptions.find((option) => option.value === "GITHUB")?.count).toBe(2);

    act(() => {
      result.current.handleTabChange("ISSUE");
    });

    await waitFor(() => {
      expect(result.current.sourceOptions.find((option) => option.value === "GITHUB")?.count).toBe(
        1,
      );
      expect(
        result.current.sourceOptions.find((option) => option.value === "CONFLUENCE")?.count,
      ).toBe(0);
      expect(result.current.tabOptions.find((option) => option.value === "PAGE")?.count).toBe(1);
    });
  });

  it("resets to page 1 when a tab is changed", async () => {
    const artifacts: Artifact[] = Array.from({ length: 30 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
    });

    act(() => {
      result.current.handleTabChange("FILE");
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("clears the search and every facet at once", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.handleSearchChange("Add feature");
      result.current.toggleSource("GITHUB");
      result.current.handleTabChange("PULL_REQUEST");
      result.current.toggleSource("UPLOAD");
      result.current.toggleFormat("PDF");
      result.current.toggleRepository("sprintstart/sprintstart-frontend");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.selectedSources.size).toBe(0);
    expect(result.current.activeTab).toBe("ALL");
    expect(result.current.selectedFormat).toBeNull();
    expect(result.current.selectedRepositories.size).toBe(0);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.filteredArtifacts).toHaveLength(5);
  });

  it("does not fetch when projectId is null", () => {
    const { result } = renderHook(() => useKnowledgeBase(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.artifacts).toHaveLength(0);
  });

  it("resets artifacts and loading state when projectId transitions to null", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const { getArtifactPage, getArtifactFacets } = mockArtifactQuery([
      makeArtifact("a1", "first.md"),
    ]);
    vi.mocked(knowledgeService.getArtifactPage).mockImplementation(getArtifactPage);
    vi.mocked(knowledgeService.getArtifactFacets).mockImplementation(getArtifactFacets);

    const initialProps: { pid: string | null } = { pid: "proj-1" };
    const { result, rerender } = renderHook(({ pid }) => useKnowledgeBase(pid), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    rerender({ pid: null });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchError).toBeNull();
    });
  });

  it("clears the facets when the project changes", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const { getArtifactPage, getArtifactFacets } = mockArtifactQuery(artifacts);
    vi.mocked(knowledgeService.getArtifactPage).mockImplementation(getArtifactPage);
    vi.mocked(knowledgeService.getArtifactFacets).mockImplementation(getArtifactFacets);

    const initialProps: { pid: string | null } = { pid: "proj-1" };
    const { result, rerender } = renderHook(({ pid }) => useKnowledgeBase(pid), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(20);
    });

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.handleTabChange("FILE");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    rerender({ pid: "proj-2" });

    // A facet chosen for one project's corpus matches nothing in the next one, and
    // the empty list it produces looks like the project having no knowledge at all.
    await waitFor(() => {
      expect(result.current.selectedSources.size).toBe(0);
      expect(result.current.activeTab).toBe("ALL");
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  it("safely indexes paginatedArtifacts when totalPages decreases", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedArtifacts).toHaveLength(5);
    });

    // Narrow to a source with 0 items.
    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
      expect(result.current.paginatedArtifacts).toHaveLength(0);
    });
  });

  it("resets currentPage to 1 when switching projectId", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const { getArtifactPage, getArtifactFacets } = mockArtifactQuery(artifacts);
    vi.mocked(knowledgeService.getArtifactPage).mockImplementation(getArtifactPage);
    vi.mocked(knowledgeService.getArtifactFacets).mockImplementation(getArtifactFacets);

    const initialProps: { pid: string | null } = { pid: "proj-1" };
    const { result, rerender } = renderHook(({ pid }) => useKnowledgeBase(pid), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(20);
    });

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
    });

    rerender({ pid: "proj-2" });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("keeps the current page when refreshing the same result set", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(2);
    });
    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
    });

    await act(async () => {
      await result.current.fetchArtifacts();
    });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedArtifacts).toHaveLength(5);
    });
  });

  it("pulls the current page back into range when it exceeds the available pages", async () => {
    // 25 artifacts at 20 per page is exactly two pages.
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(5);
    });

    await waitFor(() => {
      // Without the clamp the control would report page 5 while the slice runs off
      // the end of the list and renders nothing.
      expect(result.current.currentPage).toBe(2);
      expect(result.current.paginatedArtifacts).toHaveLength(5);
    });
  });

  it("combines the source, type and format facets with a search query", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("JIRA");
      result.current.handleTabChange("ISSUE");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
        "gh-issue",
        "jira-issue",
      ]);
    });

    act(() => {
      result.current.handleSearchChange("ticket");
    });

    await waitFor(() => {
      expect(result.current.filteredArtifacts).toHaveLength(1);
      expect(result.current.filteredArtifacts[0].id).toBe("jira-issue");
    });
  });

  it("identifies uploaded PDFs, Markdown and images with a UUID sourceId and no mime", async () => {
    const result = await renderWith([
      {
        ...makeArtifact("art-1", "specification.pdf", "FILE"),
        sourceSystem: "UPLOAD",
        sourceId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        mime: null,
      },
      {
        ...makeArtifact("art-2", "notes.md", "FILE"),
        sourceSystem: "UPLOAD",
        sourceId: "9c8b7a6d-4e3f-2a1b-0c9d-8e7f6a5b4c3d",
        mime: null,
      },
      {
        ...makeArtifact("art-3", "wireframe.png", "FILE"),
        sourceSystem: "UPLOAD",
        sourceId: "0f8e7d6c-5b4a-3928-1706-5f4e3d2c1b0a",
        mime: null,
      },
      {
        ...makeArtifact("art-4", "archive.tar.gz", "FILE"),
        sourceSystem: "UPLOAD",
        sourceId: "12345678-1234-1234-1234-123456789abc",
        mime: null,
      },
    ]);

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    const countOf = (value: string) =>
      result.current.formatOptions.find((option) => option.value === value)?.count;

    await waitFor(() => {
      // The filename is the only dependable signal: `mime` is null and `sourceId`
      // is a UUID, so an extension check on `sourceId` would have counted zero here.
      expect(countOf("PDF")).toBe(1);
      expect(countOf("MARKDOWN")).toBe(1);
      expect(countOf("IMAGE")).toBe(1);
      expect(countOf("OTHER")).toBe(1);
    });

    act(() => {
      result.current.toggleFormat("IMAGE");
    });
    await waitFor(() => {
      expect(result.current.filteredArtifacts[0].title).toBe("wireframe.png");
    });

    act(() => {
      result.current.toggleFormat("OTHER");
    });
    await waitFor(() => {
      // "Other" no longer swallows images — that is what the Images option is for.
      expect(result.current.filteredArtifacts[0].title).toBe("archive.tar.gz");
    });
  });

  it("offers tab options for types available from the selected sources plus ALL", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.tabOptions.map((option) => option.value)).toEqual([
      "ALL",
      "PULL_REQUEST",
      "ISSUE",
      "FILE",
      "PAGE",
    ]);

    act(() => {
      result.current.toggleSource("JIRA");
    });

    await waitFor(() => {
      // Jira carries issues and nothing else, so unrelated artifact-type tabs disappear.
      expect(result.current.tabOptions.map((option) => option.value)).toEqual(["ALL", "ISSUE"]);
      expect(result.current.tabOptions.find((option) => option.value === "ISSUE")?.count).toBe(1);
    });
  });

  it("keeps an active tab visible even if chosen sources cannot produce it", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.handleTabChange("PAGE");
      result.current.toggleSource("GITHUB");
    });

    await waitFor(() => {
      const page = result.current.tabOptions.find((option) => option.value === "PAGE");

      expect(page).toBeDefined();
      expect(page?.count).toBe(0);
      expect(result.current.filteredArtifacts).toHaveLength(0);
    });
  });

  it("keeps a chosen format visible after the uploads that matched it are gone", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleFormat("IMAGE");
    });

    await waitFor(() => {
      const image = result.current.formatOptions.find((option) => option.value === "IMAGE");

      expect(image).toBeDefined();
      expect(image?.count).toBe(0);
      expect(result.current.filteredArtifacts).toHaveLength(0);
    });
  });

  it("keeps a chosen repository visible after its artifacts are gone", async () => {
    const result = await renderWith(makeRepoFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
    });
    act(() => {
      result.current.toggleRepository("sprintstart/sprintstart-backend");
      result.current.handleTabChange("ISSUE");
    });

    await waitFor(() => {
      // None of the repo-scoped GitHub artifacts is an ISSUE, so the backend repo
      // can no longer be produced in scope — but the reader chose it, so the
      // option stays offered with count 0 and can still be unchosen.
      const backend = result.current.repositoryOptions.find(
        (option) => option.value === "sprintstart/sprintstart-backend",
      );

      expect(backend).toBeDefined();
      expect(backend?.count).toBe(0);
      expect(result.current.filteredArtifacts).toHaveLength(0);
    });
  });
});
