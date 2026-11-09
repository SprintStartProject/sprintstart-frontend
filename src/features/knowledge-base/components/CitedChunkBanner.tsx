import { ArrowDown, BookOpen } from "lucide-react";
import { formatLineRanges } from "../lineHighlight";

/** Tells the reader which lines of the artifact were cited, with a button to jump to them. */
export function CitedChunkBanner({
  highlightLines,
  onJump,
}: {
  highlightLines: number[] | undefined;
  onJump: () => void;
}) {
  return (
    <div
      data-testid="cited-chunk-banner"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-app-brand-border bg-app-brand-soft/90 px-3.5 py-2 text-xs font-medium text-app-brand-text shadow-xs dark:border-app-brand/40 dark:bg-app-brand/20"
    >
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 shrink-0 text-app-brand" />
        <span>Showing cited chunk ({formatLineRanges(highlightLines)})</span>
      </div>
      <button
        type="button"
        onClick={onJump}
        data-testid="jump-to-chunk-btn"
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-app-brand-border bg-app-surface px-2.5 py-1 text-xs font-semibold text-app-brand-text shadow-xs transition-colors hover:bg-app-surface-hover hover:text-app-brand"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        Jump to chunk
      </button>
    </div>
  );
}
