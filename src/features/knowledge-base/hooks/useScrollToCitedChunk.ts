import { useCallback, useEffect, type RefObject } from "react";
import { scrollToCitedLines } from "../citedChunkScroll";
import type { ArtifactContent } from "../types";

/** Time for ReactMarkdown / SyntaxHighlighter to finish rendering the DOM nodes to scroll to. */
const RENDER_SETTLE_MS = 120;

interface CitedChunkScrollOptions {
  highlightLines: number[] | undefined;
  viewMode: "raw" | "summary";
  markdownViewMode: "rendered" | "source";
  isLoading: boolean;
  content: ArtifactContent | null;
}

/**
 * Brings the cited lines into view inside `containerRef`: automatically once the raw
 * content has rendered, and on demand through the returned function (the "Jump to chunk"
 * button).
 */
export function useScrollToCitedChunk(
  containerRef: RefObject<HTMLElement | null>,
  { highlightLines, viewMode, markdownViewMode, isLoading, content }: CitedChunkScrollOptions,
): () => void {
  const scrollToHighlightedChunk = useCallback(() => {
    scrollToCitedLines(containerRef.current, highlightLines);
  }, [containerRef, highlightLines]);

  useEffect(() => {
    if (
      highlightLines &&
      highlightLines.length > 0 &&
      viewMode === "raw" &&
      !isLoading &&
      content
    ) {
      const timer = setTimeout(scrollToHighlightedChunk, RENDER_SETTLE_MS);
      return () => clearTimeout(timer);
    }
  }, [highlightLines, viewMode, isLoading, content, markdownViewMode, scrollToHighlightedChunk]);

  return scrollToHighlightedChunk;
}
