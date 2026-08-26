import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  FileCode,
  CircleDot,
  GitPullRequest,
  Building2,
  ChevronRight,
} from "lucide-react";
import type { Artifact, ArtifactType } from "../types";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { centralSpringToken } from "../../../styles/tokens";

/**
 * Props for the ArtifactList component.
 * Includes callback triggered when a user selects a specific item to view details.
 */
interface ArtifactListProps {
  artifacts: Artifact[];
  onSelect: (id: string) => void;
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
    case "ORG_METADATA":
      // Neutral like COMMIT so it never reads as a status; organizations are
      // a distinct shape, not a success/warning condition.
      return <Building2 className="h-5 w-5 text-app-text-muted" />;
    default:
      return <FileText className="h-5 w-5 text-app-text-muted" />;
  }
};

/**
 * Human-readable label for the artifact-type chip. Only overrides when the raw
 * enum value would be ugly; the org type is otherwise stored as `ORG_METADATA`,
 * which the viewer users would never type themselves.
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
}

/**
 * Single row in the artifact list. Memoized so filtering/pagination changes that
 * leave this card's props untouched don't re-render it.
 */
const ArtifactCard = memo(function ArtifactCard({ artifact, onSelect }: ArtifactCardProps) {
  return (
    <SpotlightCard
      className="p-4"
      roundedClassName="rounded-xl"
      role="button"
      tabIndex={0}
      aria-label={`View ${artifact.title ?? "artifact"}`}
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
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate font-semibold text-app-text">{artifact.title ?? "Untitled"}</h3>
            <span className="rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted uppercase">
              {getTypeLabel(artifact.artifactType)}
            </span>
            <span className="rounded-md border border-app-border bg-app-bg-soft px-2 py-0.5 text-[10px] font-bold text-app-text-muted uppercase">
              {artifact.sourceSystem}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs font-medium text-app-text-muted">
            <span>Ingested: {formatDate(artifact.ingestedAt)}</span>
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
 * ArtifactList
 *
 * Renders the unified list of knowledge base items (Uploads, PRs, Commits, Issues).
 * Uses Framer Motion's AnimatePresence to handle layout transitions as filters are applied
 * and items enter/exit the dashboard list.
 */
export function ArtifactList({ artifacts, onSelect }: ArtifactListProps) {
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
          >
            <ArtifactCard key={artifact.id} artifact={artifact} onSelect={onSelect} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
