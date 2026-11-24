import { SidePanel } from "../../components/ui/SidePanel";
import { CitationPopover } from "../../features/buddy/citations/CitationPopover";
import type { useCitationViewer } from "../../features/buddy/citations/useCitationViewer";
import { BuddyPmReplies } from "../../features/buddy/components/BuddyPmReplies";
import type { usePmReplies } from "../../features/buddy/hooks/usePmReplies";
import { ArtifactViewerDrawer } from "../../features/knowledge-base/components/ArtifactViewerDrawer";

type BuddyOverlaysProps = {
  viewer: ReturnType<typeof useCitationViewer>;
  /** The conversation's project, or empty when there is none to open an artifact in. */
  citationProjectId: string | null | undefined;
  replies: ReturnType<typeof usePmReplies>;
  repliesOpen: boolean;
  onCloseReplies: () => void;
};

/**
 * The citation popover and the artifact drawer, once a reply's sources are clicked: the popover
 * near the `[N]`, the drawer for the source itself. Rendered by the surface (not the thread) so the
 * fixed overlays are not clipped by the scroll container, and gated on the conversation's project
 * — the drawer fetches the artifact content by id within one. Plus what the hire sent to a person,
 * in the drawer the header button opens.
 */
export function BuddyOverlays({
  viewer,
  citationProjectId,
  replies,
  repliesOpen,
  onCloseReplies,
}: BuddyOverlaysProps) {
  return (
    <>
      {viewer.selectedCitation && (
        <CitationPopover
          selected={viewer.selectedCitation}
          onClose={viewer.closeCitation}
          onOpenArtifact={citationProjectId ? viewer.handleOpenArtifact : undefined}
        />
      )}

      {viewer.citationArtifact && citationProjectId && (
        <ArtifactViewerDrawer
          artifact={viewer.citationArtifact}
          onClose={viewer.closeArtifact}
          projectId={citationProjectId}
          highlightLines={viewer.highlightLines}
          canDelete={false}
          onDelete={() => {}}
        />
      )}

      <SidePanel
        isOpen={repliesOpen}
        onClose={onCloseReplies}
        title="Sent to your PM"
        widthClassName="w-full sm:w-[26rem]"
        contentClassName="py-4"
        closeAriaLabel="Close what you sent to your PM"
      >
        <BuddyPmReplies {...replies} />
      </SidePanel>
    </>
  );
}
