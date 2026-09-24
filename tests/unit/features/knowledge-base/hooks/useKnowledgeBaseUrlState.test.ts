import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseKnowledgeBaseSearch,
  toKnowledgeBaseSearchString,
  useKnowledgeBaseUrlState,
} from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBaseUrlState";

const parse = (search: string) => parseKnowledgeBaseSearch(new URLSearchParams(search));

describe("parseKnowledgeBaseSearch", () => {
  it("returns the defaults for an empty query string", () => {
    const state = parse("");
    expect(state.tab).toBe("ALL");
    expect(state.search).toBe("");
    expect(state.sources.size).toBe(0);
    expect(state.repositories.size).toBe(0);
    expect(state.format).toBeNull();
    expect(state.page).toBe(1);
    expect(state.size).toBe(DEFAULT_PAGE_SIZE);
    expect(state.artifactId).toBeNull();
  });

  it("reads every param it owns", () => {
    const state = parse(
      "?tab=FILE&q=auth%20flow&sources=GITHUB,UPLOAD&repos=acme/api&format=PDF&page=3&size=50&artifact=a-1",
    );
    expect(state.tab).toBe("FILE");
    expect(state.search).toBe("auth flow");
    expect([...state.sources]).toEqual(["GITHUB", "UPLOAD"]);
    expect([...state.repositories]).toEqual(["acme/api"]);
    expect(state.format).toBe("PDF");
    expect(state.page).toBe(3);
    expect(state.size).toBe(50);
    expect(state.artifactId).toBe("a-1");
  });

  it("accepts repeated set params as well as comma lists, de-duplicated", () => {
    const state = parse("?sources=GITHUB&sources=JIRA,GITHUB");
    expect([...state.sources]).toEqual(["GITHUB", "JIRA"]);
  });

  it("drops unknown enum values instead of forwarding them to the API", () => {
    const state = parse("?tab=BOGUS&sources=GITHUB,NOPE&format=EXE");
    expect(state.tab).toBe("ALL");
    expect([...state.sources]).toEqual(["GITHUB"]);
    expect(state.format).toBeNull();
  });

  it("matches enum values case-insensitively", () => {
    const state = parse("?tab=pull_request&sources=upload&format=pdf");
    expect(state.tab).toBe("PULL_REQUEST");
    expect([...state.sources]).toEqual(["UPLOAD"]);
    expect(state.format).toBe("PDF");
  });

  it("ignores a format without Uploads and repositories without GitHub", () => {
    const state = parse("?sources=JIRA&format=PDF&repos=acme/api");
    expect(state.format).toBeNull();
    expect(state.repositories.size).toBe(0);
  });

  it.each([
    ["page=0", 1],
    ["page=-4", 1],
    ["page=abc", 1],
    ["page=2.5", 1],
    ["page=7", 7],
  ])("clamps %s to page %i", (query, expected) => {
    expect(parse(`?${query}`).page).toBe(expected);
  });

  it.each([
    ["size=0", 1],
    ["size=500", MAX_PAGE_SIZE],
    ["size=abc", DEFAULT_PAGE_SIZE],
    ["size=50", 50],
  ])("clamps %s to size %i", (query, expected) => {
    expect(parse(`?${query}`).size).toBe(expected);
  });
});

describe("toKnowledgeBaseSearchString", () => {
  it("keeps commas and slashes readable and returns an empty string when empty", () => {
    const params = new URLSearchParams();
    params.set("sources", "GITHUB,JIRA");
    params.set("repos", "acme/api");
    expect(toKnowledgeBaseSearchString(params)).toBe("?sources=GITHUB,JIRA&repos=acme/api");
    expect(toKnowledgeBaseSearchString(new URLSearchParams())).toBe("");
  });
});

interface HarnessProps {
  projectId: string | null;
  projectSettled?: boolean;
}

/** Renders the hook together with the router's view of the location and a navigate handle. */
function renderUrlState(initialEntries: string[], initialProps: HarnessProps) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      MemoryRouter,
      { initialEntries, initialIndex: initialEntries.length - 1 },
      children,
    );
  }
  return renderHook(
    ({ projectId, projectSettled }: HarnessProps) => ({
      api: useKnowledgeBaseUrlState(projectId, { projectSettled }),
      location: useLocation(),
      navigate: useNavigate(),
    }),
    { wrapper: Wrapper, initialProps },
  );
}

describe("useKnowledgeBaseUrlState", () => {
  it("restores the filters of a shared link on first render", () => {
    const { result } = renderUrlState(["/kb?sources=GITHUB&repos=acme/api&tab=FILE&page=2"], {
      projectId: "p1",
    });
    expect([...result.current.api.state.sources]).toEqual(["GITHUB"]);
    expect([...result.current.api.state.repositories]).toEqual(["acme/api"]);
    expect(result.current.api.state.tab).toBe("FILE");
    expect(result.current.api.state.page).toBe(2);
  });

  it("omits defaults from the URL", () => {
    const { result } = renderUrlState(["/kb?tab=FILE&page=3&size=50"], { projectId: "p1" });
    act(() => result.current.api.setTab("ALL"));
    act(() => result.current.api.setSize(DEFAULT_PAGE_SIZE));
    expect(result.current.location.search).toBe("");
  });

  it("pushes discrete choices so Back undoes the last click", () => {
    const { result } = renderUrlState(["/start", "/kb"], { projectId: "p1" });
    act(() => result.current.api.toggleSource("GITHUB"));
    act(() => result.current.api.setTab("FILE"));
    expect(result.current.location.search).toBe("?sources=GITHUB&tab=FILE");

    act(() => void result.current.navigate(-1));
    expect(result.current.location.search).toBe("?sources=GITHUB");
    expect(result.current.api.state.tab).toBe("ALL");
    expect([...result.current.api.state.sources]).toEqual(["GITHUB"]);
  });

  it("replaces for search typing and the drawer, so Back leaves the page", () => {
    const { result } = renderUrlState(["/start", "/kb"], { projectId: "p1" });
    act(() => result.current.api.setSearch("a"));
    act(() => result.current.api.setSearch("ab"));
    act(() => result.current.api.setArtifactId("art-1"));
    expect(result.current.location.search).toBe("?q=ab&artifact=art-1");

    act(() => void result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/start");
  });

  it("does not add a history entry for a write that changes nothing", () => {
    const { result } = renderUrlState(["/start", "/kb?tab=FILE"], { projectId: "p1" });
    act(() => result.current.api.setTab("FILE"));
    act(() => void result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/start");
  });

  it("builds several writes in one event on each other", () => {
    const { result } = renderUrlState(["/kb"], { projectId: "p1" });
    act(() => {
      result.current.api.toggleSource("UPLOAD");
      result.current.api.toggleFormat("PDF");
      result.current.api.toggleSource("GITHUB");
      result.current.api.toggleRepository("acme/api");
    });
    expect(result.current.location.search).toBe("?sources=UPLOAD,GITHUB&format=PDF&repos=acme/api");
  });

  it("drops the dependent facet together with its source", () => {
    const { result } = renderUrlState(["/kb?sources=UPLOAD,GITHUB&format=PDF&repos=acme/api"], {
      projectId: "p1",
    });
    act(() => result.current.api.toggleSource("UPLOAD"));
    expect(result.current.location.search).toBe("?sources=GITHUB&repos=acme/api");
    act(() => result.current.api.toggleSource("GITHUB"));
    expect(result.current.location.search).toBe("");
  });

  it("resets the page on every filter change and keeps other params", () => {
    const { result } = renderUrlState(["/kb?page=4&size=50&projectId=x"], { projectId: "p1" });
    act(() => result.current.api.toggleSource("JIRA"));
    expect(result.current.location.search).toBe("?size=50&projectId=x&sources=JIRA");
  });

  it("clears every filter but keeps the page size and the open artifact", () => {
    const { result } = renderUrlState(
      ["/kb?tab=FILE&q=x&sources=GITHUB&repos=a/b&page=2&size=50&artifact=a-1"],
      { projectId: "p1" },
    );
    act(() => result.current.api.clearFilters());
    expect(result.current.location.search).toBe("?size=50&artifact=a-1");
  });
});

describe("useKnowledgeBaseUrlState project switches", () => {
  const SHARED = "/kb?tab=FILE&q=x&sources=GITHUB&repos=a/b&page=2&size=50&artifact=a-1";

  it("keeps a shared link's filters while the project resolves from nothing", () => {
    const { result, rerender } = renderUrlState([SHARED], { projectId: null });
    rerender({ projectId: "p1" });
    expect(result.current.location.search).toBe(SHARED.slice(3));
    expect(result.current.api.state.tab).toBe("FILE");
  });

  it("keeps a shared link's filters while the project context is still loading", () => {
    const { result, rerender } = renderUrlState([SHARED], {
      projectId: "fallback",
      projectSettled: false,
    });
    rerender({ projectId: "stored-selection", projectSettled: true });
    expect(result.current.location.search).toBe(SHARED.slice(3));
    expect(result.current.api.state.page).toBe(2);
  });

  it("clears project-scoped params on a switch between two settled projects", () => {
    const { result, rerender } = renderUrlState(["/start", SHARED], { projectId: "p1" });
    rerender({ projectId: "p2" });
    expect(result.current.location.search).toBe("?size=50");
    expect(result.current.api.state.tab).toBe("ALL");
    expect(result.current.api.state.sources.size).toBe(0);
    expect(result.current.api.state.artifactId).toBeNull();
    expect(result.current.api.scopeProjectId).toBe("p2");

    // The clean-up replaced the entry instead of pushing one.
    act(() => void result.current.navigate(-1));
    expect(result.current.location.pathname).toBe("/start");
  });

  it("reports the cleared state in the very render that sees the new project", () => {
    const seen: string[] = [];
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(MemoryRouter, { initialEntries: [SHARED] }, children);
    }
    const { rerender } = renderHook(
      ({ projectId }: { projectId: string }) => {
        const { state } = useKnowledgeBaseUrlState(projectId);
        seen.push(`${projectId}:${state.tab}`);
      },
      { wrapper: Wrapper, initialProps: { projectId: "p1" } },
    );
    seen.length = 0;
    rerender({ projectId: "p2" });
    expect(seen).not.toContain("p2:FILE");
    expect(seen).toContain("p2:ALL");
  });

  it("lets new filters be chosen right after a switch", () => {
    const { result, rerender } = renderUrlState(["/kb?tab=FILE"], { projectId: "p1" });
    rerender({ projectId: "p2" });
    expect(result.current.location.search).toBe("");
    act(() => result.current.api.setTab("FILE"));
    expect(result.current.api.state.tab).toBe("FILE");
    expect(result.current.location.search).toBe("?tab=FILE");
  });
});

describe("useKnowledgeBaseUrlState sort", () => {
  it("parses a known order case-insensitively and drops an unknown one", () => {
    expect(parse("?sort=title_asc").sort).toBe("TITLE_ASC");
    expect(parse("?sort=CHANGED_DESC").sort).toBe("CHANGED_DESC");
    // The backend answers an unknown order with a 400; the URL must never be able to cause one.
    expect(parse("?sort=POPULAR").sort).toBe("ADDED_DESC");
    expect(parse("").sort).toBe("ADDED_DESC");
  });

  it("writes a non-default order, omits the default, and restarts at page 1", () => {
    const { result } = renderUrlState(["/kb?page=4"], { projectId: "p1" });

    act(() => result.current.api.setSort("CHANGED_DESC"));
    expect(result.current.location.search).toBe("?sort=CHANGED_DESC");

    act(() => result.current.api.setSort("ADDED_DESC"));
    expect(result.current.location.search).toBe("");
  });

  it("pushes a sort change so Back restores the previous order", () => {
    const { result } = renderUrlState(["/kb"], { projectId: "p1" });

    act(() => result.current.api.setSort("TITLE_ASC"));
    act(() => void result.current.navigate(-1));

    expect(result.current.api.state.sort).toBe("ADDED_DESC");
  });

  it("keeps the order through Clear filters and a project switch", () => {
    const { result, rerender } = renderUrlState(["/kb?sort=TITLE_ASC&sources=JIRA"], {
      projectId: "p1",
    });

    act(() => result.current.api.clearFilters());
    expect(result.current.location.search).toBe("?sort=TITLE_ASC");

    rerender({ projectId: "p2" });
    expect(result.current.api.state.sort).toBe("TITLE_ASC");
  });
});

describe("useKnowledgeBaseUrlState date range", () => {
  it("reads a valid range, drops invalid ends and swaps a reversed pair", () => {
    expect(parse("?from=2026-09-01&to=2026-09-24").dateRange).toEqual({
      from: "2026-09-01",
      to: "2026-09-24",
    });
    expect(parse("?from=2026-02-30&to=2026-09-24").dateRange).toEqual({
      from: null,
      to: "2026-09-24",
    });
    // The backend 400s on from > to; a hand-edited link must not be able to trigger it.
    expect(parse("?from=2026-09-24&to=2026-09-01").dateRange).toEqual({
      from: "2026-09-01",
      to: "2026-09-24",
    });
    expect(parse("").dateRange).toEqual({ from: null, to: null });
  });

  it("writes the range, restarts at page 1, and removes an open end", () => {
    const { result } = renderUrlState(["/kb?page=3"], { projectId: "p1" });

    act(() => result.current.api.setDateRange({ from: "2026-09-01", to: "2026-09-24" }));
    expect(result.current.location.search).toBe("?from=2026-09-01&to=2026-09-24");

    act(() => result.current.api.setDateRange({ from: "2026-09-01", to: null }));
    expect(result.current.location.search).toBe("?from=2026-09-01");
  });

  it("pushes by default and replaces when asked", () => {
    const { result } = renderUrlState(["/start", "/kb"], { projectId: "p1" });

    act(() => result.current.api.setDateRange({ from: "2026-09-01", to: null }));
    act(() => result.current.api.setDateRange({ from: "2026-09-02", to: null }, "replace"));
    act(() => void result.current.navigate(-1));

    // One push, one replace: Back leaves the range entirely instead of stepping through edits.
    expect(result.current.location.pathname).toBe("/kb");
    expect(result.current.api.state.dateRange.from).toBeNull();
  });

  it("is cleared by Clear filters and by a project switch", () => {
    const { result, rerender } = renderUrlState(["/kb?from=2026-09-01&to=2026-09-24"], {
      projectId: "p1",
    });

    act(() => result.current.api.clearFilters());
    expect(result.current.location.search).toBe("");

    act(() => result.current.api.setDateRange({ from: "2026-09-01", to: null }));
    rerender({ projectId: "p2" });
    expect(result.current.api.state.dateRange).toEqual({ from: null, to: null });
  });
});
