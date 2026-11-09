import { useEffect, useRef, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import type { Artifact, ArtifactContent } from "../types";
import { useArtifactDeletion } from "../hooks/useArtifactDeletion";
import { useArtifactDrawerData } from "../hooks/useArtifactDrawerData";
import { useScrollToCitedChunk } from "../hooks/useScrollToCitedChunk";
import { contentKind, shouldRenderAsMarkdown } from "../artifactPresentation";
import { findConnector } from "../../data-ingestion/connectors/registry";
import { createMarkdownComponents } from "./markdownComponents";
import { questionForArtifact, quoteForChat } from "../../../hooks/askAiQuote";
import { useArtifactSelection } from "../hooks/useArtifactSelection";
import { useAskAi } from "../../../hooks/useAskAi";
import { summariseBlockReason } from "../summarizability";
import { getArtifactRepository } from "../githubMetadata";
import { RepositoryBadge } from "./RepositoryBadge";
import { SourceLinkBadge } from "./SourceLinkBadge";
import { SidePanel } from "../../../components/ui/SidePanel";
import { ArtifactContentBody } from "./ArtifactContentBody";
import { CitedChunkBanner } from "./CitedChunkBanner";
import { DeleteArtifactDialog } from "./DeleteArtifactDialog";
import { DrawerActions } from "./DrawerActions";
import { SummaryView } from "./SummaryView";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame.ts";
import { DinoGameLazy } from "../../easter-eggs/components/DinoGameLazy.tsx";
import { DinoPlayHint } from "../../easter-eggs/components/DinoPlayHint.tsx";

/**
 * Props for the ArtifactViewerDrawer component.
 */
interface ArtifactViewerDrawerProps {
  artifact: Artifact | null;
  /** Closes the drawer and clears the selected artifact in the parent. */
  onClose: () => void;
  /** Project scope required to fetch the artifact content and summary. */
  projectId: string;
  /** Optional line numbers to highlight and scroll into view. */
  highlightLines?: number[];
  /** When true, renders the Delete button for UPLOAD-sourced artifacts. The
   *  parent gates this via accessPolicy Pattern A (PM/HR/ADMIN only). */
  canDelete: boolean;
  /** Called after a successful deletion so the parent can clear the selection
   *  and re-fetch the artifact list. */
  onDelete: (artifactId: string) => void;
  /** Whether to lock background scrolling while the drawer is open. Defaults to true. */
  lockScroll?: boolean;
}

/**
 * How the artifact's connector presents it, or undefined for a source system the
 * frontend does not know yet. Such an artifact is shown as plain content with its
 * source link and cannot be deleted.
 */
function knowledgeBaseOf(artifact: Artifact) {
  return findConnector(artifact.sourceSystem)?.knowledgeBase;
}

function rendersAsMarkdown(content: ArtifactContent | null, artifact: Artifact | null): boolean {
  const connectorRendersMarkdown =
    artifact !== null && knowledgeBaseOf(artifact)?.markdown === true;
  return shouldRenderAsMarkdown(content, artifact, connectorRendersMarkdown);
}

/**
 * ArtifactViewerDrawer
 *
 * Slide-out panel that displays the raw content of a selected artifact.
 * Allows users to trigger an AI summarization of the content to quickly extract key information
 * without reading massive files or issues. The summary is streamed over Server-Sent Events and
 * rendered incrementally as tokens arrive; citation metadata is rendered as a source list.
 */
export function ArtifactViewerDrawer({
  artifact,
  onClose,
  projectId,
  highlightLines,
  canDelete,
  onDelete,
  lockScroll = true,
}: ArtifactViewerDrawerProps) {
  const skipContentLoad = Boolean(
    artifact && knowledgeBaseOf(artifact)?.metadataView?.appliesTo(artifact),
  );
  const { state, dispatch, summarize } = useArtifactDrawerData(
    artifact,
    projectId,
    skipContentLoad,
  );
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToHighlightedChunk = useScrollToCitedChunk(contentContainerRef, {
    highlightLines,
    viewMode: state.viewMode,
    markdownViewMode: state.markdownViewMode,
    isLoading: state.isLoading,
    content: state.content,
  });

  const markdownComponents = useMemo(
    () => createMarkdownComponents(highlightLines),
    [highlightLines],
  );

  const {
    viewMode,
    markdownViewMode,
    content,
    summary,
    citations,
    isLoading,
    isFetchingSummary,
    isIndexing,
    isDeleting,
    isConfirmDeleteOpen,
    stageDetail,
    error,
  } = state;

  // The waiting game: Space while the summary streams — and, because this wait
  // runs minutes, the same opening behind a tap so it is not keyboard-only.
  // `artifact !== null` keeps the trigger disarmed while the drawer is closed
  // but its last summary state is still on the reducer (the stream aborts, the
  // flags stay); `viewMode === "summary"` keeps it disarmed on the raw view,
  // where the stream may still be running in the background — a Space press
  // there is a scroll, not an opening, and no game could be seen anyway.
  const dinoUnlocked = useDinoUnlocked();
  const [dinoActive, closeDino, openDino] = useSpaceOpensDino(
    isFetchingSummary && artifact !== null && viewMode === "summary",
    dinoUnlocked,
    { keepActiveUntilExit: true },
  );
  // The game's box lives in the summary view, so the game must leave with it.
  // `keepActiveUntilExit` deliberately keeps a run alive when the wait merely
  // ends, but these exits do not end the wait — the drawer can close (the
  // backdrop, the X, the page clearing its selection), "Back to File" flips
  // `viewMode` to raw, and selecting another artifact resets the reducer to
  // raw as well. The drawer never unmounts in any of them (both host pages
  // keep it mounted and toggle `artifact`), so without this the game would
  // hold the one shared slot invisibly — no other surface could ever open it
  // again, and a later summarise would resurrect the abandoned game.
  // Closing is the hook's own `close`, which frees the slot eagerly.
  useEffect(() => {
    if ((artifact === null || viewMode !== "summary") && dinoActive) {
      closeDino();
    }
  }, [artifact, viewMode, dinoActive, closeDino]);

  // Only the summary stream can set `error` while the summary view is up
  // (`summarizeStart` clears it and the retry loop keeps fetching), so the
  // game's badge can read a failure from it.
  const summaryFailed = !isFetchingSummary && error !== null;

  const handleDelete = useArtifactDeletion({ artifact, projectId, dispatch, onDelete });

  /** Opens the delete confirmation, clearing any prior delete error. */
  const openDeleteConfirm = () => {
    dispatch({ type: "openDeleteConfirm" });
  };

  const titleContent =
    viewMode === "summary" ? (
      <button
        onClick={() => dispatch({ type: "showRaw" })}
        className="flex items-center gap-1 rounded-md border border-transparent p-1.5 text-sm font-medium text-app-text-muted transition-colors hover:border-app-border hover:bg-app-surface"
        data-testid="back-to-file-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to File
      </button>
    ) : (
      <div className="line-clamp-1 text-lg font-semibold text-app-text">{artifact?.title}</div>
    );

  const canDeleteThisArtifact =
    canDelete && artifact !== null && knowledgeBaseOf(artifact)?.deletable === true;

  const isMarkdownArtifact = artifact && content ? rendersAsMarkdown(content, artifact) : false;

  const isPdfOrImage =
    content?.mimeType === "application/pdf" || (content?.mimeType.startsWith("image/") ?? false);
  const canHighlight = highlightLines && highlightLines.length > 0 && !isPdfOrImage;

  // A known-empty or near-empty artifact is refused before the round trip: the AI
  // service would index it first and only then answer that there is nothing to
  // summarise. Null while the content is still loading, or for formats that are
  // not text at all -- see summariseBlockReason.
  const askAi = useAskAi();

  /**
   * Whatever the reader has highlighted in the document, while they have it.
   *
   * The action below quotes it; with nothing selected it asks about the whole
   * artifact instead. The offer lives here rather than floating over the text,
   * because a button positioned over a selection covers the lines around it —
   * and the lines around a selection are usually the next thing being read.
   */
  const selection = useArtifactSelection(contentContainerRef);

  const ask = () => {
    const prompt = selection.text
      ? quoteForChat({
          text: selection.text,
          source: artifact?.title ?? null,
          url: artifact?.sourceUrl ?? null,
        })
      : questionForArtifact({ title: artifact?.title, url: artifact?.sourceUrl });

    if (askAi(prompt)) selection.clear();
  };

  const summariseBlockedReason = summariseBlockReason(content);

  // The connector's own view for an artifact that has no content to fetch.
  const metadataView = artifact ? knowledgeBaseOf(artifact)?.metadataView : undefined;
  const MetadataView = artifact && metadataView?.appliesTo(artifact) ? metadataView.View : null;

  const actionsContent = viewMode === "raw" && !MetadataView && (
    <DrawerActions
      showMarkdownSwitch={isMarkdownArtifact && content !== null}
      markdownViewMode={markdownViewMode}
      onMarkdownViewMode={(mode) => dispatch({ type: "setMarkdownViewMode", mode })}
      hasSelection={Boolean(selection.text)}
      onAsk={ask}
      summariseBlockedReason={summariseBlockedReason}
      onSummarize={() => void summarize()}
      canDelete={canDeleteThisArtifact}
      isDeleting={isDeleting}
      onDelete={openDeleteConfirm}
    />
  );

  // GitHub repo artifacts show their `owner/repository` in the header's badge
  // row; other kinds have no repository to name, so the badge stays unset.
  const repository = artifact ? getArtifactRepository(artifact) : null;
  const hasSourceLink =
    Boolean(artifact?.sourceUrl?.trim()) &&
    artifact !== null &&
    knowledgeBaseOf(artifact)?.linkLabel !== null;

  const headerBadge =
    repository || hasSourceLink ? (
      <>
        {repository && (
          <RepositoryBadge repository={repository} testId="artifact-drawer-repo-badge" />
        )}
        {hasSourceLink && artifact?.sourceUrl && (
          <SourceLinkBadge
            sourceUrl={artifact.sourceUrl}
            sourceSystem={artifact.sourceSystem}
            testId="artifact-drawer-source-link"
          />
        )}
      </>
    ) : undefined;

  return (
    <SidePanel
      isOpen={!!artifact}
      onClose={onClose}
      title={titleContent}
      badge={headerBadge}
      actions={actionsContent}
      widthClassName="w-full max-w-5xl"
      zIndexClassName="z-50"
      // The `!` is load-bearing: Tailwind emits `sm:` utilities after `max-*` variants, so a
      // plain `max-[1025px]:rounded-none` would lose to the SidePanel's `sm:rounded-l-[28px]`.
      // The bound is 1025, not `lg`'s 1024, because this drawer is `w-full max-w-5xl`: at a
      // 1024px window — an iPad on its side — it is still full-bleed, and a corner there would
      // notch against the viewport. From 1025 up the page shows beside it and the corner stands.
      panelClassName="border-l border-app-border shadow-2xl max-[1025px]:rounded-none!"
      panelBackgroundClassName="bg-app-surface"
      headerClassName="p-4 bg-app-bg"
      contentClassName="p-6"
      lockScroll={lockScroll}
    >
      {error && viewMode === "raw" ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-4 text-app-danger-text">
          <p className="font-medium">Error loading content</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : viewMode === "raw" && MetadataView && artifact ? (
        <div data-testid="raw-content" aria-busy={false}>
          <MetadataView artifact={artifact} />
        </div>
      ) : viewMode === "raw" ? (
        <div ref={contentContainerRef} data-testid="raw-content" aria-busy={isLoading}>
          {isLoading ? (
            <div className="animate-pulse space-y-4 motion-reduce:animate-none">
              <div className="h-4 w-3/4 rounded bg-app-border"></div>
              <div className="h-4 w-1/2 rounded bg-app-border"></div>
              <div className="h-4 w-5/6 rounded bg-app-border"></div>
              <div className="h-4 w-2/3 rounded bg-app-border"></div>
            </div>
          ) : (
            <>
              {canHighlight && (
                <CitedChunkBanner
                  highlightLines={highlightLines}
                  onJump={scrollToHighlightedChunk}
                />
              )}
              <ArtifactContentBody
                kind={contentKind(
                  content,
                  content !== null && rendersAsMarkdown(content, artifact),
                  markdownViewMode,
                )}
                content={content}
                artifact={artifact}
                isMarkdownArtifact={isMarkdownArtifact}
                highlightLines={highlightLines}
                markdownComponents={markdownComponents}
              />
            </>
          )}
        </div>
      ) : (
        <SummaryView
          summary={summary}
          citations={citations}
          error={error}
          isFetchingSummary={isFetchingSummary}
          isIndexing={isIndexing}
          stageDetail={stageDetail}
          gameHint={
            dinoUnlocked && isFetchingSummary && !dinoActive ? (
              <DinoPlayHint onPlay={openDino} className="mb-4" />
            ) : null
          }
          gameBox={
            dinoActive ? (
              <div className="mb-4">
                <DinoGameLazy
                  onExit={closeDino}
                  // The badge may only claim the state the summary actually
                  // reached, and only once nothing is in flight.
                  replyReady={dinoActive && !isFetchingSummary}
                  completionLabel={summaryFailed ? "Summary failed" : "Summary ready"}
                  completionTone={summaryFailed ? "danger" : "success"}
                />
              </div>
            ) : null
          }
          onRetry={() => void summarize()}
          onBack={() => dispatch({ type: "showRaw" })}
        />
      )}

      <DeleteArtifactDialog
        isOpen={isConfirmDeleteOpen}
        artifactTitle={artifact?.title}
        isDeleting={isDeleting}
        onCancel={() => dispatch({ type: "closeDeleteConfirm" })}
        onConfirm={() => void handleDelete()}
      />
    </SidePanel>
  );
}
