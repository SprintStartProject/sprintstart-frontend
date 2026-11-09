import { describe, expect, it } from "vitest";
import {
  drawerReducer,
  initialState,
  type DrawerAction,
  type DrawerState,
} from "../../../../src/features/knowledge-base/drawerState";

const CONTENT = { content: "text", mimeType: "text/plain", isObjectUrl: false };
const CITATION = { artifactId: "a-1", filename: "a.md", sourceUrl: null };

function stateWith(overrides: Partial<DrawerState>): DrawerState {
  return { ...initialState, ...overrides };
}

function reduce(action: DrawerAction, overrides: Partial<DrawerState> = {}): DrawerState {
  return drawerReducer(stateWith(overrides), action);
}

describe("drawerReducer", () => {
  describe("loading", () => {
    it("starts a fresh load from the initial state", () => {
      const next = reduce(
        { type: "reset" },
        { viewMode: "summary", summary: "old", content: CONTENT, isDeleting: true, error: "x" },
      );

      expect(next).toEqual({ ...initialState, isLoading: true });
    });

    it("starts loading and clears an earlier error without touching the content", () => {
      const next = reduce({ type: "loadStart" }, { error: "boom", content: CONTENT });

      expect(next.isLoading).toBe(true);
      expect(next.error).toBeNull();
      expect(next.content).toBe(CONTENT);
    });

    it("stores the loaded content and stops loading", () => {
      const next = reduce({ type: "loadSuccess", content: CONTENT }, { isLoading: true });

      expect(next.isLoading).toBe(false);
      expect(next.content).toBe(CONTENT);
    });

    it("stops loading without content when there is nothing to fetch", () => {
      const next = reduce({ type: "skipContentLoad" }, { isLoading: true });

      expect(next.isLoading).toBe(false);
      expect(next.content).toBeNull();
    });

    it("stops loading and keeps the error", () => {
      const next = reduce({ type: "loadError", error: "gone" }, { isLoading: true });

      expect(next.isLoading).toBe(false);
      expect(next.error).toBe("gone");
    });

    it("switches the markdown view mode", () => {
      expect(reduce({ type: "setMarkdownViewMode", mode: "source" }).markdownViewMode).toBe(
        "source",
      );
      expect(
        reduce({ type: "setMarkdownViewMode", mode: "rendered" }, { markdownViewMode: "source" })
          .markdownViewMode,
      ).toBe("rendered");
    });
  });

  describe("summarising", () => {
    it("starts a summary on a clean slate and shows it", () => {
      const next = reduce(
        { type: "summarizeStart" },
        {
          summary: "old",
          citations: [CITATION],
          isIndexing: true,
          stageDetail: "stage",
          error: "failed",
        },
      );

      expect(next.viewMode).toBe("summary");
      expect(next.summary).toBe("");
      expect(next.citations).toEqual([]);
      expect(next.isFetchingSummary).toBe(true);
      expect(next.isIndexing).toBe(false);
      expect(next.stageDetail).toBeUndefined();
      expect(next.error).toBeNull();
    });

    it("waits for indexing and drops the stage text", () => {
      const next = reduce({ type: "summarizeIndexing" }, { stageDetail: "stage" });

      expect(next.isFetchingSummary).toBe(true);
      expect(next.isIndexing).toBe(true);
      expect(next.stageDetail).toBeUndefined();
    });

    it("records the stage the backend reports and ends the indexing wait", () => {
      const next = reduce(
        { type: "summarizeStage", name: "retrieve", detail: "Reading..." },
        { isIndexing: true },
      );

      expect(next.isFetchingSummary).toBe(true);
      expect(next.isIndexing).toBe(false);
      expect(next.stageDetail).toBe("Reading...");
    });

    it("appends tokens in order", () => {
      const first = reduce({ type: "summarizeToken", chunk: "Hel" }, { summary: "" });
      const second = drawerReducer(first, { type: "summarizeToken", chunk: "lo" });

      expect(second.summary).toBe("Hello");
    });

    it("appends citations in order", () => {
      const other = { artifactId: "a-2", filename: "b.md", sourceUrl: "https://x" };
      const first = reduce({ type: "summarizeCitation", citation: CITATION });
      const second = drawerReducer(first, { type: "summarizeCitation", citation: other });

      expect(second.citations).toEqual([CITATION, other]);
    });

    it("finishes without touching the text", () => {
      const next = reduce(
        { type: "summarizeDone" },
        { summary: "kept", isFetchingSummary: true, isIndexing: true },
      );

      expect(next.isFetchingSummary).toBe(false);
      expect(next.isIndexing).toBe(false);
      expect(next.summary).toBe("kept");
    });

    it("stops fetching and keeps the error", () => {
      const next = reduce(
        { type: "summarizeError", error: "bad" },
        { isFetchingSummary: true, isIndexing: true },
      );

      expect(next.isFetchingSummary).toBe(false);
      expect(next.isIndexing).toBe(false);
      expect(next.error).toBe("bad");
    });

    it("goes back to the file", () => {
      const next = reduce({ type: "showRaw" }, { viewMode: "summary", summary: "kept" });

      expect(next.viewMode).toBe("raw");
      expect(next.summary).toBe("kept");
    });
  });

  describe("deleting", () => {
    it("marks the deletion as running", () => {
      expect(reduce({ type: "deleteStart" }).isDeleting).toBe(true);
    });

    it.each(["deleteSuccess", "deleteFailed"] as const)(
      "stops the running deletion on %s but leaves the confirmation as it was",
      (type) => {
        const next = reduce({ type }, { isDeleting: true, isConfirmDeleteOpen: true });

        expect(next.isDeleting).toBe(false);
        expect(next.isConfirmDeleteOpen).toBe(true);
      },
    );

    it("opens and closes the confirmation", () => {
      const opened = reduce({ type: "openDeleteConfirm" });
      expect(opened.isConfirmDeleteOpen).toBe(true);

      expect(drawerReducer(opened, { type: "closeDeleteConfirm" }).isConfirmDeleteOpen).toBe(false);
    });
  });

  it("returns the same state for an action it does not know", () => {
    const state = stateWith({ summary: "kept" });

    expect(drawerReducer(state, { type: "nope" } as unknown as DrawerAction)).toBe(state);
  });

  it("leaves every other field alone", () => {
    const state = stateWith({ summary: "s", content: CONTENT, error: "e" });

    const next = drawerReducer(state, { type: "deleteStart" });

    expect(next).toEqual({ ...state, isDeleting: true });
  });
});
