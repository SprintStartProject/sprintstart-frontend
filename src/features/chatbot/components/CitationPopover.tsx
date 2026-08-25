import { useEffect, useRef } from "react";
import { ExternalLink, Plus } from "lucide-react";
import type { SelectedCitation } from "../../../context/ChatContext";
import { getCitationPopoverStyle } from "../utils/popoverPosition";

type CitationPopoverProps = {
  /** The citation the user clicked, plus the anchor rect for positioning. */
  selected: SelectedCitation;
  /** Called when the popover should close (Esc, outside click, or X button). */
  onClose: () => void;
  /** Optional callback to open the artifact in the side drawer. */
  onOpenArtifact?: (data: {
    artifactId: string;
    filename: string;
    sourceUrl?: string;
    lines: number[];
  }) => void;
};

/**
 * Floating popover that appears below a clicked `[N]` citation reference,
 * showing the source filename, line/page, and a link to the original. Closes
 * on Escape, on a click outside the popover, or via the explicit close button
 * (E2). Position is computed by {@link getCitationPopoverStyle} so it stays
 * on-screen near the anchor.
 */
export function CitationPopover({ selected, onClose, onOpenArtifact }: CitationPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    // Defer attaching the outside-click handler by one tick so the click
    // that *opened* the popover doesn't immediately close it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 0);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.clearTimeout(id);
    };
  }, [onClose]);

  const { citation } = selected;

  return (
    <div
      ref={ref}
      style={getCitationPopoverStyle(selected.rect)}
      className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-lg"
    >
      <div className="mb-2 flex items-start justify-between">
        <h3 className="truncate pr-4 text-sm font-semibold text-app-text">{citation.filename}</h3>

        <button
          aria-label="Close citation"
          onClick={onClose}
          className="text-app-text-muted transition-colors hover:text-app-text"
        >
          <Plus size={18} className="rotate-45" />
        </button>
      </div>

      <div className="mb-2 text-xs leading-relaxed text-app-text-muted">
        {citation.startLine !== undefined && `Line ${citation.startLine}`}
        {citation.startPage !== undefined && `Page ${citation.startPage}`}
      </div>

      {onOpenArtifact && citation.artifactId ? (
        <button
          type="button"
          onClick={() => {
            onOpenArtifact({
              artifactId: citation.artifactId,
              filename: citation.filename,
              sourceUrl: citation.sourceUrl,
              lines:
                citation.startLine !== undefined && citation.startLine !== null
                  ? [citation.startLine]
                  : [],
            });
            onClose();
          }}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-app-brand-text hover:underline"
        >
          Open source
          <ExternalLink size={12} />
        </button>
      ) : citation.sourceUrl ? (
        <a
          href={citation.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline"
        >
          Open source
          <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}
