import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileCode, CircleDot, GitPullRequest, ChevronRight } from 'lucide-react';
import type { Artifact, ArtifactType } from '../types';
import { centralSpringToken } from '../../../styles/tokens';

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
        case 'COMMIT': return <FileText className="w-5 h-5 text-app-text-muted" />;
        case 'FILE': return <FileCode className="w-5 h-5 text-app-brand" />;
        case 'ISSUE': return <CircleDot className="w-5 h-5 text-app-warning-text" />;
        case 'PULL_REQUEST': return <GitPullRequest className="w-5 h-5 text-app-success-text" />;
        default: return <FileText className="w-5 h-5 text-app-text-muted" />;
    }
};

const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
        <motion.div
            key={artifact.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={centralSpringToken}
            role="button"
            tabIndex={0}
            aria-label={`View ${artifact.title ?? 'artifact'}`}
            data-testid="artifact-card"
            onClick={() => onSelect(artifact.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(artifact.id);
                }
            }}
            className="group flex cursor-pointer items-start gap-4 rounded-xl border border-app-border bg-app-surface p-4 transition-all duration-200 hover:scale-[1.01] hover:border-app-brand-border-strong hover:bg-app-surface-hover hover:shadow-lg motion-reduce:hover:scale-100"
        >
            <div className="p-2 bg-app-bg-soft rounded-lg shrink-0 border border-app-border">
                {getIcon(artifact.artifactType)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-app-text truncate">{artifact.title ?? 'Untitled'}</h3>
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md bg-app-bg-soft border border-app-border text-app-text-muted">
                        {artifact.artifactType}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md bg-app-bg-soft border border-app-border text-app-text-muted">
                        {artifact.sourceSystem}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-app-text-muted mt-2">
                    <span>Ingested: {formatDate(artifact.ingestedAt)}</span>
                </div>
            </div>
            <div className="shrink-0 pt-2">
                <ChevronRight className="w-5 h-5 text-app-text-muted group-hover:text-app-brand transition-colors" />
            </div>
        </motion.div>
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
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>No artifacts found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <AnimatePresence mode="popLayout">
                {artifacts.map((artifact) => (
                    <ArtifactCard
                        key={artifact.id}
                        artifact={artifact}
                        onSelect={onSelect}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}
