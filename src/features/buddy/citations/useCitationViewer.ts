import { useCallback, useMemo, useState } from "react";
import { deriveArtifactFromCitation, type CitationArtifactOpen } from "./citationArtifact";
import type { SelectedCitation } from "./types";

/**
 * The citation viewing state one surface needs: the popover a clicked `[N]` opens, and the
 * artifact drawer "Open source" hands the click to.
 *
 * Extracted because two surfaces show the same citations — the `/buddy` page and the dock — and
 * the alternative was a handful of lines each surface would otherwise have copied: a selected
 * citation, the artifact being viewed, the derived `Artifact` the
 * knowledge-base drawer renders, and the handlers between them. Each surface renders its own
 * `CitationPopover` and `ArtifactViewerDrawer` from this state; the state itself never leaves the
 * surface that opened it.
 *
 * Every handler is stable for the life of the surface: they are handed down through the
 * memoised `BuddyThread` to its rows, where a fresh identity per render would re-render every
 * turn with it (see `BuddyThread`'s props contract).
 */
export function useCitationViewer() {
  const [selectedCitation, setSelectedCitation] = useState<SelectedCitation | null>(null);
  const [viewingCitationArtifact, setViewingCitationArtifact] =
    useState<CitationArtifactOpen | null>(null);

  // Resolved from the citation, not re-fetched: the drawer loads the real content by id and only
  // needs these fields for what it shows around it — the "Open in ..." link, the render mode.
  const citationArtifact = useMemo(
    () => (viewingCitationArtifact ? deriveArtifactFromCitation(viewingCitationArtifact) : null),
    [viewingCitationArtifact],
  );

  const handleCitationClick = useCallback(
    (citation: SelectedCitation) => setSelectedCitation(citation),
    [],
  );
  const closeCitation = useCallback(() => setSelectedCitation(null), []);
  const handleOpenArtifact = useCallback(
    (data: CitationArtifactOpen) => setViewingCitationArtifact(data),
    [],
  );
  const closeArtifact = useCallback(() => setViewingCitationArtifact(null), []);

  return {
    /** The citation whose popover is open, if any. */
    selectedCitation,
    /** The artifact the drawer would show, derived for it. `null` while nothing is open. */
    citationArtifact,
    /** The lines the drawer highlights — the ones the citation pointed at. */
    highlightLines: viewingCitationArtifact?.lines,
    handleCitationClick,
    closeCitation,
    handleOpenArtifact,
    closeArtifact,
  };
}
