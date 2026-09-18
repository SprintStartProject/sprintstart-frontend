import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useKnowledgeBase } from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: {
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

/** Renders the hook against a fixed artifact list and waits for the fetch to land. */
async function renderWith(artifacts: Artifact[]) {
  const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
  vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

  const { result } = renderHook(() => useKnowledgeBase("proj-1"));

  await waitFor(() => {
    expect(result.current.artifacts).toHaveLength(artifacts.length);
  });

  return result;
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
    const result = await renderWith([
      makeArtifact("a1", "readme.md"),
      makeArtifact("a2", "contributing.md"),
    ]);

    act(() => {
      result.current.handleSearchChange("readme");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].title).toBe("readme.md");
    expect(result.current.currentPage).toBe(1);
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
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.handleSearchChange("file-0");
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("narrows to a single source", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].sourceSystem).toBe("UPLOAD");
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("unions several sources instead of replacing the last one", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("JIRA");
    });

    expect(result.current.selectedSources.size).toBe(2);
    expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
      "gh-issue",
      "gh-pr",
      "jira-issue",
    ]);
  });

  it("ANDs the type facet with the source facet", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleType("PULL_REQUEST");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].id).toBe("gh-pr");
  });

  it("matches one type across every source, so Issues covers GitHub and Jira alike", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleType("ISSUE");
    });

    expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
      "gh-issue",
      "jira-issue",
    ]);

    // The two-tier bar needed GITHUB:ISSUES and JIRA:ISSUES — the second labelled
    // "Tickets" — to express this. One artifactType, one option.
    const typeValues = result.current.typeOptions.map((option) => option.value);
    expect(typeValues).toContain("ISSUE");
    expect(typeValues).not.toContain("TICKET");
  });

  it("offers the file-format facet only while Uploads is selected", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.formatOptions).toHaveLength(0);

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    // The fixture holds one PDF upload, so that is the only format worth offering.
    expect(result.current.formatOptions.map((option) => option.value)).toEqual(["PDF"]);
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

    // The format facet describes uploads; it must not hide the GitHub artifacts.
    expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
      "gh-issue",
      "gh-pr",
      "up-pdf",
    ]);
  });

  it("clears the format selection when Uploads is deselected", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleFormat("PDF");
    });
    expect(result.current.selectedFormat).toBe("PDF");

    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    // Otherwise a hidden facet keeps filtering and the trigger badge counts
    // something the reader can no longer see or clear.
    expect(result.current.selectedFormat).toBeNull();
    expect(result.current.formatOptions).toHaveLength(0);
    expect(result.current.filteredArtifacts).toHaveLength(5);
  });

  it("counts each option against the other facets, not just the search", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.sourceOptions.find((option) => option.value === "GITHUB")?.count).toBe(2);

    act(() => {
      result.current.toggleType("ISSUE");
    });

    // With Issues on, GitHub can only contribute one artifact — the count has to
    // say so, or the number promises rows that clicking will not deliver.
    expect(result.current.sourceOptions.find((option) => option.value === "GITHUB")?.count).toBe(1);
    expect(
      result.current.sourceOptions.find((option) => option.value === "CONFLUENCE")?.count,
    ).toBe(0);
    // A facet's own counts ignore its own selection, or a second option in the
    // same facet could never be added to the first.
    expect(result.current.typeOptions.find((option) => option.value === "PAGE")?.count).toBe(1);
  });

  it("resets to page 1 when a facet is toggled", async () => {
    const artifacts: Artifact[] = Array.from({ length: 30 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.toggleType("FILE");
    });

    expect(result.current.currentPage).toBe(1);
  });

  it("clears the search and every facet at once", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.handleSearchChange("Add feature");
      result.current.toggleSource("GITHUB");
      result.current.toggleType("PULL_REQUEST");
      result.current.toggleSource("UPLOAD");
      result.current.toggleFormat("PDF");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.handleClearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.selectedSources.size).toBe(0);
    expect(result.current.selectedTypes.size).toBe(0);
    expect(result.current.selectedFormat).toBeNull();
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

  it("clears the facets when the project changes", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
    vi.mocked(knowledgeService.getUnifiedArtifacts).mockResolvedValue(artifacts);

    const initialProps: { pid: string | null } = { pid: "proj-1" };
    const { result, rerender } = renderHook(({ pid }) => useKnowledgeBase(pid), {
      initialProps,
    });

    await waitFor(() => {
      expect(result.current.artifacts).toHaveLength(25);
    });

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleType("FILE");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    rerender({ pid: "proj-2" });

    // A facet chosen for one project's corpus matches nothing in the next one, and
    // the empty list it produces looks like the project having no knowledge at all.
    await waitFor(() => {
      expect(result.current.selectedSources.size).toBe(0);
      expect(result.current.selectedTypes.size).toBe(0);
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
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedArtifacts).toHaveLength(5);

    // Narrow to a source with 0 items.
    act(() => {
      result.current.toggleSource("UPLOAD");
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.paginatedArtifacts).toHaveLength(0);
  });

  it("resets currentPage to 1 when switching projectId", async () => {
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const { knowledgeService } = await import("../../../../../src/services/knowledgeService");
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
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

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
    // 25 artifacts at 20 per page is exactly two pages.
    const artifacts: Artifact[] = Array.from({ length: 25 }, (_, i) =>
      makeArtifact(`a${i}`, `file-${i}.md`),
    );
    const result = await renderWith(artifacts);

    act(() => {
      result.current.setCurrentPage(5);
    });

    // Without the clamp the control would report page 5 while the slice runs off
    // the end of the list and renders nothing.
    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedArtifacts).toHaveLength(5);
  });

  it("combines the source, type and format facets with a search query", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("GITHUB");
      result.current.toggleSource("JIRA");
      result.current.toggleType("ISSUE");
    });

    expect(result.current.filteredArtifacts.map((artifact) => artifact.id).sort()).toEqual([
      "gh-issue",
      "jira-issue",
    ]);

    act(() => {
      result.current.handleSearchChange("ticket");
    });

    expect(result.current.filteredArtifacts).toHaveLength(1);
    expect(result.current.filteredArtifacts[0].id).toBe("jira-issue");
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

    // The filename is the only dependable signal: `mime` is null and `sourceId`
    // is a UUID, so an extension check on `sourceId` would have counted zero here.
    expect(countOf("PDF")).toBe(1);
    expect(countOf("MARKDOWN")).toBe(1);
    expect(countOf("IMAGE")).toBe(1);
    expect(countOf("OTHER")).toBe(1);

    act(() => {
      result.current.toggleFormat("IMAGE");
    });
    expect(result.current.filteredArtifacts[0].title).toBe("wireframe.png");

    act(() => {
      result.current.toggleFormat("OTHER");
    });
    // "Other" no longer swallows images — that is what the Images option is for.
    expect(result.current.filteredArtifacts[0].title).toBe("archive.tar.gz");
  });
  it("offers only the types the chosen sources can produce", async () => {
    const result = await renderWith(makeFacetFixture());

    expect(result.current.typeOptions.map((option) => option.value)).toEqual([
      "PULL_REQUEST",
      "ISSUE",
      "FILE",
      "PAGE",
    ]);

    act(() => {
      result.current.toggleSource("JIRA");
    });

    // Jira carries issues and nothing else, so no dead Pull requests / Files / Docs.
    expect(result.current.typeOptions.map((option) => option.value)).toEqual(["ISSUE"]);

    act(() => {
      result.current.toggleSource("GITHUB");
    });

    expect(result.current.typeOptions.map((option) => option.value)).toEqual([
      "PULL_REQUEST",
      "ISSUE",
    ]);
  });

  it("keeps a selected type visible once the chosen sources cannot produce it", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleType("PAGE");
    });
    act(() => {
      result.current.toggleSource("GITHUB");
    });

    const page = result.current.typeOptions.find((option) => option.value === "PAGE");

    // Still listed, so it can be unchecked; the count tells the truth about it.
    expect(page).toBeDefined();
    expect(page?.count).toBe(0);
    expect(result.current.filteredArtifacts).toHaveLength(0);
  });
  it("keeps a chosen format visible after the uploads that matched it are gone", async () => {
    const result = await renderWith(makeFacetFixture());

    act(() => {
      result.current.toggleSource("UPLOAD");
    });
    act(() => {
      result.current.toggleFormat("IMAGE");
    });

    const image = result.current.formatOptions.find((option) => option.value === "IMAGE");

    expect(image).toBeDefined();
    expect(image?.count).toBe(0);
    expect(result.current.filteredArtifacts).toHaveLength(0);
  });
});
