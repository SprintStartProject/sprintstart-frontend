import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAvailableSources } from "../../../../src/features/buddy/hooks/useAvailableSources";

const { mockGetArtifactFacets } = vi.hoisted(() => ({ mockGetArtifactFacets: vi.fn() }));

vi.mock("../../../../src/services/knowledgeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/services/knowledgeService")>();
  return {
    ...actual,
    knowledgeService: { ...actual.knowledgeService, getArtifactFacets: mockGetArtifactFacets },
  };
});

function facets(sources: Array<[string, number]>) {
  return {
    types: [],
    sources: sources.map(([value, count]) => ({ value, count })),
    formats: [],
    repositories: [],
  };
}

describe("useAvailableSources", () => {
  it("offers every source the project has indexed that the chat can filter by, uploads included", async () => {
    mockGetArtifactFacets.mockResolvedValue(
      facets([
        ["GITHUB", 12],
        ["JIRA", 3],
        ["CONFLUENCE", 1],
      ]),
    );

    const { result } = renderHook(() => useAvailableSources("project-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetArtifactFacets).toHaveBeenCalledWith("project-1");
    expect([...result.current.sources].sort()).toEqual(["CONFLUENCE", "GITHUB", "JIRA", "UPLOAD"]);
  });

  it("offers Bitbucket and Notion when the project has them indexed", async () => {
    mockGetArtifactFacets.mockResolvedValue(
      facets([
        ["BITBUCKET", 2],
        ["NOTION", 4],
      ]),
    );

    const { result } = renderHook(() => useAvailableSources("project-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.sources].sort()).toEqual(["BITBUCKET", "NOTION", "UPLOAD"]);
  });

  it("leaves out a source with nothing indexed and any system the chat has no filter for", async () => {
    mockGetArtifactFacets.mockResolvedValue(
      facets([
        ["GITHUB", 5],
        ["JIRA", 0],
        ["SONARQUBE", 7],
      ]),
    );

    const { result } = renderHook(() => useAvailableSources("project-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect([...result.current.sources].sort()).toEqual(["GITHUB", "UPLOAD"]);
  });

  it("offers uploads only when the lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetArtifactFacets.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => useAvailableSources("project-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sources).toEqual(["UPLOAD"]);
  });

  it("makes no request and offers uploads only without a project", () => {
    mockGetArtifactFacets.mockClear();

    const { result } = renderHook(() => useAvailableSources(null));

    expect(result.current).toEqual({ sources: ["UPLOAD"], loading: false });
    expect(mockGetArtifactFacets).not.toHaveBeenCalled();
  });
});
