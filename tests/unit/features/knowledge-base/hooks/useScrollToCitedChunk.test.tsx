import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollToCitedChunk } from "../../../../../src/features/knowledge-base/hooks/useScrollToCitedChunk";
import type { ArtifactContent } from "../../../../../src/features/knowledge-base/types";

const CONTENT: ArtifactContent = { content: "x", mimeType: "text/plain", isObjectUrl: false };

interface Options {
  highlightLines: number[] | undefined;
  viewMode: "raw" | "summary";
  markdownViewMode: "rendered" | "source";
  isLoading: boolean;
  content: ArtifactContent | null;
}

const READY: Options = {
  highlightLines: [2],
  viewMode: "raw",
  markdownViewMode: "rendered",
  isLoading: false,
  content: CONTENT,
};

function mount(options: Partial<Options> = {}) {
  const container = document.createElement("div");
  container.innerHTML = "<p id='line-2'></p>";
  const ref = { current: container };
  const hook = renderHook((props: Options) => useScrollToCitedChunk(ref, props), {
    initialProps: { ...READY, ...options },
  });
  return { ...hook, ref };
}

const scrollIntoView = () => vi.mocked(HTMLElement.prototype.scrollIntoView);

describe("useScrollToCitedChunk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("scrolls 120ms after the raw content has rendered, not before", () => {
    mount();

    vi.advanceTimersByTime(119);
    expect(scrollIntoView()).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(scrollIntoView()).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Partial<Options>]>([
    ["no line is cited", { highlightLines: undefined }],
    ["the cited line list is empty", { highlightLines: [] }],
    ["the summary is showing", { viewMode: "summary" }],
    ["the content is still loading", { isLoading: true }],
    ["there is no content", { content: null }],
  ])("does not scroll on its own when %s", (_name, options) => {
    mount(options);

    vi.advanceTimersByTime(1000);

    expect(scrollIntoView()).not.toHaveBeenCalled();
  });

  it("does not scroll if it unmounts before the delay is over", () => {
    const { unmount } = mount();

    unmount();
    vi.advanceTimersByTime(1000);

    expect(scrollIntoView()).not.toHaveBeenCalled();
  });

  it("scrolls again when the markdown view mode changes", () => {
    const { rerender } = mount();
    vi.advanceTimersByTime(200);

    rerender({ ...READY, markdownViewMode: "source" });
    vi.advanceTimersByTime(200);

    expect(scrollIntoView()).toHaveBeenCalledTimes(2);
  });

  it("scrolls again when the content is replaced", () => {
    const { rerender } = mount();
    vi.advanceTimersByTime(200);

    rerender({ ...READY, content: { ...CONTENT } });
    vi.advanceTimersByTime(200);

    expect(scrollIntoView()).toHaveBeenCalledTimes(2);
  });

  it("hands back a function that scrolls at once, for the jump button", () => {
    const { result } = mount({ viewMode: "summary" });

    result.current();

    expect(scrollIntoView()).toHaveBeenCalledTimes(1);
  });
});
