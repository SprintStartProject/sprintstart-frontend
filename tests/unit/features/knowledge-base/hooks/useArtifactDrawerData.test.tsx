import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArtifactDrawerData } from "../../../../../src/features/knowledge-base/hooks/useArtifactDrawerData";
import type { Artifact } from "../../../../../src/features/knowledge-base/types";
import { knowledgeService } from "../../../../../src/services/knowledgeService";

vi.mock("../../../../../src/services/knowledgeService", () => ({
  knowledgeService: { getArtifactContent: vi.fn(), streamArtifactSummary: vi.fn() },
}));

const getContent = vi.mocked(knowledgeService.getArtifactContent);
const stream = vi.mocked(knowledgeService.streamArtifactSummary);

function artifact(id: string, overrides: Partial<Artifact> = {}): Artifact {
  return {
    id,
    title: `${id}.md`,
    artifactType: "FILE",
    sourceSystem: "GITHUB",
    sourceId: `source-${id}`,
    sourceUrl: null,
    mime: "text/markdown",
    language: null,
    ingestedAt: "2026-01-01T00:00:00Z",
    lastChangedAt: null,
    contentHash: "hash",
    ingestionRunId: null,
    ...overrides,
  };
}

const CONTENT = { content: "# Hello", mimeType: "text/markdown", isObjectUrl: false };

function mount(initial: Artifact | null, skipContentLoad = false) {
  return renderHook(
    ({ subject, skip }: { subject: Artifact | null; skip: boolean }) =>
      useArtifactDrawerData(subject, "proj-1", skip),
    { initialProps: { subject: initial, skip: skipContentLoad } },
  );
}

describe("useArtifactDrawerData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContent.mockResolvedValue(CONTENT);
    stream.mockResolvedValue(undefined);
  });

  describe("loading the content", () => {
    it("loads the artifact's content from its project and source system", async () => {
      const { result } = mount(artifact("a-1", { sourceSystem: "CONFLUENCE" }));

      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));
      expect(getContent).toHaveBeenCalledWith("proj-1", "a-1", "CONFLUENCE");
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it("is loading until the content arrives", async () => {
      let arrive!: (content: typeof CONTENT) => void;
      getContent.mockReturnValue(new Promise((resolve) => (arrive = resolve)));

      const { result } = mount(artifact("a-1"));

      expect(result.current.state.isLoading).toBe(true);
      expect(result.current.state.content).toBeNull();
      await act(() => {
        arrive(CONTENT);
        return Promise.resolve();
      });
      expect(result.current.state.isLoading).toBe(false);
    });

    it("keeps the message of a failed load", async () => {
      getContent.mockRejectedValue(new Error("not found"));

      const { result } = mount(artifact("a-1"));

      await waitFor(() => expect(result.current.state.error).toBe("not found"));
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.content).toBeNull();
    });

    it("stringifies a failure that is not an error object", async () => {
      getContent.mockRejectedValue("gone");

      const { result } = mount(artifact("a-1"));

      await waitFor(() => expect(result.current.state.error).toBe("gone"));
    });

    it("does nothing without an artifact", () => {
      const { result } = mount(null);

      expect(getContent).not.toHaveBeenCalled();
      expect(result.current.state.isLoading).toBe(false);
    });

    it("fetches nothing for an artifact shown from its metadata, and stops loading", async () => {
      const { result } = mount(artifact("org-1"), true);

      await waitFor(() => expect(result.current.state.isLoading).toBe(false));
      expect(getContent).not.toHaveBeenCalled();
      expect(result.current.state.content).toBeNull();
    });

    it("starts over for the next artifact", async () => {
      const { result, rerender } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));
      act(() => result.current.dispatch({ type: "openDeleteConfirm" }));
      getContent.mockResolvedValue({ ...CONTENT, content: "# Second" });

      rerender({ subject: artifact("a-2"), skip: false });

      await waitFor(() => expect(result.current.state.content?.content).toBe("# Second"));
      expect(getContent).toHaveBeenLastCalledWith("proj-1", "a-2", "GITHUB");
      expect(result.current.state.isConfirmDeleteOpen).toBe(false);
    });

    it("ignores a late answer for an artifact that is no longer open", async () => {
      let answerFirst!: (content: typeof CONTENT) => void;
      getContent.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
      const { result, rerender } = mount(artifact("a-1"));
      getContent.mockResolvedValueOnce({ ...CONTENT, content: "# Second" });

      rerender({ subject: artifact("a-2"), skip: false });
      await waitFor(() => expect(result.current.state.content?.content).toBe("# Second"));
      await act(() => {
        answerFirst({ ...CONTENT, content: "# Stale" });
        return Promise.resolve();
      });

      expect(result.current.state.content?.content).toBe("# Second");
    });

    it("ignores a late failure for an artifact that is no longer open", async () => {
      let failFirst!: (reason: Error) => void;
      getContent.mockReturnValueOnce(new Promise((_resolve, reject) => (failFirst = reject)));
      const { result, rerender } = mount(artifact("a-1"));

      rerender({ subject: artifact("a-2"), skip: false });
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));
      await act(() => {
        failFirst(new Error("stale failure"));
        return Promise.resolve();
      });

      expect(result.current.state.error).toBeNull();
    });
  });

  describe("object URLs", () => {
    it("revokes the URL of replaced content and of content left behind on unmount", async () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      getContent.mockResolvedValueOnce({
        content: "blob:one",
        mimeType: "image/png",
        isObjectUrl: true,
      });
      const { result, rerender, unmount } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content?.content).toBe("blob:one"));
      expect(revoke).not.toHaveBeenCalled();
      getContent.mockResolvedValueOnce({
        content: "blob:two",
        mimeType: "image/png",
        isObjectUrl: true,
      });

      rerender({ subject: artifact("a-2"), skip: false });
      await waitFor(() => expect(result.current.state.content?.content).toBe("blob:two"));
      expect(revoke).toHaveBeenCalledWith("blob:one");

      unmount();
      expect(revoke).toHaveBeenCalledWith("blob:two");
      revoke.mockRestore();
    });

    it("revokes nothing for content that is not an object URL", async () => {
      const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      const { result, unmount } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));

      unmount();

      expect(revoke).not.toHaveBeenCalled();
      revoke.mockRestore();
    });
  });

  describe("summarize", () => {
    it("streams the summary of the open artifact", async () => {
      const { result } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));

      await act(() => result.current.summarize());

      expect(stream).toHaveBeenCalledWith(
        "proj-1",
        "a-1",
        expect.any(Object),
        expect.any(AbortSignal),
      );
      expect(result.current.state.viewMode).toBe("summary");
    });

    it("does nothing without an artifact", async () => {
      const { result } = mount(null);

      await act(() => result.current.summarize());

      expect(stream).not.toHaveBeenCalled();
      expect(result.current.state.viewMode).toBe("raw");
    });

    it("aborts the stream when the drawer unmounts", async () => {
      let signal: AbortSignal | undefined;
      stream.mockImplementation((_p, _a, _h, streamSignal) => {
        signal = streamSignal;
        return new Promise<void>(() => {});
      });
      const { result, unmount } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));
      act(() => void result.current.summarize());
      expect(signal?.aborted).toBe(false);

      unmount();

      expect(signal?.aborted).toBe(true);
    });

    it("aborts the stream when another artifact is opened", async () => {
      let signal: AbortSignal | undefined;
      stream.mockImplementation((_p, _a, _h, streamSignal) => {
        signal = streamSignal;
        return new Promise<void>(() => {});
      });
      const { result, rerender } = mount(artifact("a-1"));
      await waitFor(() => expect(result.current.state.content).toEqual(CONTENT));
      act(() => void result.current.summarize());

      rerender({ subject: artifact("a-2"), skip: false });

      expect(signal?.aborted).toBe(true);
    });
  });
});
