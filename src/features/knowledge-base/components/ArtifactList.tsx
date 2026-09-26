import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Building2,
  ChevronRight,
  CircleDot,
  FileCode,
  FileText,
  GitPullRequest,
} from "lucide-react";
import type { Artifact, ArtifactAiStatus, ArtifactType } from "../types";
import { AI_STATUS_CHIPS } from "../aiStatus";
import { AiStatusChip } from "./AiStatusChip";
import { getArtifactRepository } from "../githubMetadata";
import { isUpload } from "../tabs";
import { RepositoryBadge } from "./RepositoryBadge";
import { Checkbox } from "../../../components/ui/Checkbox";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { centralSpringToken } from "../../../styles/tokens";

/**
 * Select mode for the bulk delete. Absent means no checkboxes at all: they are
 * revealed by an explicit toggle, never permanent, so the card keeps being one
 * button that opens the drawer.
 */
export interface ArtifactListSelection {
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

/**
 * Props for the ArtifactList component.
 * Includes callback triggered when a user selects a specific item to view details.
 */
interface ArtifactListProps {
  artifacts: Artifact[];
  onSelect: (id: string) => void;
  selection?: ArtifactListSelection;
  /**
   * AI index status per artifact id. Absent (the AI was unavailable, the request failed or has
   * not answered) or missing an id means no chip for that card — never a guessed one.
   */
  aiStatuses?: ReadonlyMap<string, ArtifactAiStatus> | null;
}

const getIcon = (type: ArtifactType) => {
  switch (type) {
    case "COMMIT":
      return <FileText className="h-5 w-5 text-app-text-muted" />;
    case "FILE":
      return <FileCode className="h-5 w-5 text-app-brand" />;
    case "ISSUE":
      return <CircleDot className="h-5 w-5 text-app-warning-text" />;
    case "PULL_REQUEST":
      return <GitPullRequest className="h-5 w-5 text-app-success-text" />;
    case "PAGE":
      return <BookOpen className="h-5 w-5 text-app-brand" />;
    case "ORG_METADATA":
      // Neutral like COMMIT so it never reads as a status; organizations are
      // a distinct shape, not a success/warning condition.
      return <Building2 className="h-5 w-5 text-app-text-muted" />;
    default:
      return <FileText className="h-5 w-5 text-app-text-muted" />;
  }
};

/**
 * Human-readable label for the artifact-type chip. The chip shows the raw
 * artifact type for every other kind, which reads fine ("COMMIT", "ISSUE");
 * `ORG_METADATA` is the one value that names its storage shape rather than the
 * thing itself, so it gets a word a reader would actually use.
 */
const getTypeLabel = (type: ArtifactType): string =>
  type === "ORG_METADATA" ? "Organization" : type;

const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

interface ArtifactCardProps {
  artifact: Artifact;
  onSelect: (id: string) => void;
  aiStatus?: ArtifactAiStatus;
}

/**
 * Single row in the artifact list. Memoized so filtering/pagination changes that
 * leave this card's props untouched don't re-render it.
 */
const ArtifactCard = memo(function ArtifactCard({
  artifact,
  onSelect,
  aiStatus,
}: ArtifactCardProps) {
  const repository = getArtifactRepository(artifact);

  return (
    <SpotlightCard
      className="p-4"
      roundedClassName="rounded-xl"
      role="button"
      tabIndex={0}
      aria-label={`View ${artifact.title ?? "artifact"}${repository ? ` from ${repository}` : ""}${
        aiStatus ? `, ${AI_STATUS_CHIPS[aiStatus].spoken}` : ""
      }`}
      data-testid="artifact-card"
      onClick={() => onSelect(artifact.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(artifact.id);
        }
      }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-lg border border-app-border bg-app-bg-soft p-2">
          {getIcon(artifact.artifactType)}
        </div>
        <div className="min-w-0 flex-1">
          {/* flex-wrap: on a phone the chips wrap below the title instead of the row
              overflowing; the title still ellipsizes within its line. */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {/* h2: the cards sit directly under the page's h1, and a skipped level fails axe's
                heading-order once the list is on screen. */}
            <h2 className="min-w-0 truncate font-semibold text-app-text">
              {artifact.title ?? "Untitled"}
            </h2>
            <span className="shrink-0 rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted uppercase">
              {getTypeLabel(artifact.artifactType)}
            </span>
            <span className="shrink-0 rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted uppercase">
              {artifact.sourceSystem}
            </span>
            {repository && <RepositoryBadge repository={repository} testId="artifact-repo-badge" />}
            {aiStatus && <AiStatusChip status={aiStatus} />}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs font-medium text-app-text-muted">
            <span>Ingested: {formatDate(artifact.ingestedAt)}</span>
            {/* Only shown once the content actually changed: an artifact that still matches its
                import has nothing useful to say here, and an always-present date that equals
                "Ingested" would just be noise. */}
            {artifact.lastChangedAt && <span>Changed: {formatDate(artifact.lastChangedAt)}</span>}
          </div>
        </div>
        <div className="shrink-0 pt-2">
          <ChevronRight className="h-5 w-5 text-app-text-muted transition-colors group-hover:text-app-brand" />
        </div>
      </div>
    </SpotlightCard>
  );
});

/**
 * The checkbox column in select mode. Only uploads get a checkbox — the same
 * rule as the drawer's delete (connector artifacts are removed by their sync,
 * not by hand); every other row keeps an empty slot so the cards stay aligned.
 * It sits beside the card, never inside it, so no control nests in the
 * card's button.
 */
function SelectSlot({
  artifact,
  selection,
}: {
  artifact: Artifact;
  selection: ArtifactListSelection;
}) {
  if (!isUpload(artifact)) return <span className="w-5 shrink-0" aria-hidden="true" />;
  return (
    <Checkbox
      checked={selection.selectedIds.has(artifact.id)}
      onChange={() => selection.onToggle(artifact.id)}
      aria-label={`Select ${artifact.title ?? "upload"}`}
      data-testid={`artifact-select-${artifact.id}`}
    />
  );
}

/**
 * ArtifactList
 *
 * Renders the unified list of knowledge base items (Uploads, PRs, Commits, Issues).
 * Uses Framer Motion's AnimatePresence to handle layout transitions as filters are applied
 * and items enter/exit the dashboard list.
 */
export function ArtifactList({ artifacts, onSelect, selection, aiStatuses }: ArtifactListProps) {
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-app-text-muted">
        <FileText className="mb-4 h-12 w-12 opacity-50" />
        <p>No artifacts found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {artifacts.map((artifact) => (
          <motion.div
            key={artifact.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={centralSpringToken}
            className={selection ? "flex items-center gap-3" : undefined}
          >
            {selection && <SelectSlot artifact={artifact} selection={selection} />}
            <div className={selection ? "min-w-0 flex-1" : undefined}>
              <ArtifactCard
                artifact={artifact}
                onSelect={onSelect}
                aiStatus={aiStatuses?.get(artifact.id)}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
