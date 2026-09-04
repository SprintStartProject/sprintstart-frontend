import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useKnowledgeBase } from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
    getUnifiedArtifacts: vi.fn(),
  },
}));

function makeArtifact(id: string, title: string): Artifact {
  return {
    id,
    title,
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
  };
}

describe("useKnowledgeBase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads artifacts on mount", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue([
      makeArtifact("a1", "first.md"),
    ]);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(1);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchError).toBeNull();
  });

  it("a newer fetch overwrites a stale one, not the other way around", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const mockFn = vi.mocked(knowledgeService.getUnifiedArtifacts);

    let resolveFirst: (value: Artifact[]) => void = () => {};
    const firstPromise = new Promise<Artifact[]>((resolve) => {
      resolveFirst = resolve;
    });

    mockFn.mockReturnValueOnce(firstPromise);
    mockFn.mockResolvedValueOnce([makeArtifact("a2", "newer.md")]);

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
      resolveFirst([makeArtifact("a1", "stale.md")]);
      await Promise.resolve();
    });

    expect(result.current.artifacts[0].title).toBe("newer.md");
  });

  it("sets fetchError when the fetch rejects", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockRejectedValue(new Error("Server down"));

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.fetchError).not.toBeNull();
    });

    expect(result.current.fetchError).toContain("Failed to load artifacts");
    expect(result.current.isLoading).toBe(false);
  });

  it("filters by search query", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue([
      makeArtifact("a1", "readme.md"),
      makeArtifact("a2", "contributing.md"),
    ]);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(2);
    });

    act(() => {
      result.current.handleSearchChange("readme");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].title).toBe("readme.md");
    expect(result.current.currentPage).toBe(1);
  });

  it("resets to page 1 when search changes", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    expect(result.current.totalPages).toBe(2);

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.handleSearchChange("file-0");
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("filters by tab (UPLOADS)", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue([
      makeArtifact("a1", "github.md"),
      { ...makeArtifact("a2", "upload.pdf"), sourceSystem: "UPLOAD" as const },
    ]);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(2);
    });

    act(() => {
      result.current.handleTabChange("UPLOADS");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].sourceSystem).toBe("UPLOAD");
  });

  it("clears filters", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue([
      makeArtifact("a1", "readme.md"),
      makeArtifact("a2", "contributing.md"),
    ]);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(2);
    });

    act(() => {
      result.current.handleSearchChange("readme");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.handleClearFilters();
    });
    expect(result.current.filteredArtifacts).toHaveLength(2);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("does not fetch when projectId is null", () => {
    const { result } = renderHook(() => useKnowledgeBase(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.artifacts).toHaveLength(0);
  });

  it("resets artifacts and loading state when projectId transitions to null", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue([
      makeArtifact("a1", "first.md"),
    ]);

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

  it("safely indexes paginatedArtifacts when totalPages decreases", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedArtifacts).toHaveLength(5);

    // Switch tab to UPLOADS where there are 0 items
    act(() => {
      result.current.handleTabChange("UPLOADS");
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedArtifacts).toHaveLength(0);
  });

  it("resets currentPage to 1 when switching projectId", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const initialProps: { pid: string | null } = { pid: "proj-1" };
    const { result, rerender } = renderHook(({ pid }) => useKnowledgeBase(pid), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    rerender({ pid: "proj-2" });

    await waitFor(() => {
      expect(result.current.currentPage).toBe(1);
    });
  });

  it("keeps the current page when refreshing the same result set", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    await act(async () => {
      await result.current.fetchArtifacts();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedArtifacts).toHaveLength(5);
  });

  it("pulls the current page back into range when it exceeds the available pages", async () => {
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    // 25 artifacts at 20 per page is exactly two pages.
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const { result } = renderHook(() => useKnowledgeBase("proj-1"));

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    act(() => {
      result.current.setCurrentPage(5);
    });

    // Without the clamp the control would report page 5 while the slice runs off
    // the end of the list and renders nothing.
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedArtifacts).toHaveLength(5);
  });
});
