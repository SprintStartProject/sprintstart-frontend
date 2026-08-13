import { memo } from "react";
import { FileText } from "lucide-react";
import type { ArtifactSummaryCitation } from "../types";

interface CitationsListProps {
  citations: ArtifactSummaryCitation[];
}

/**
 * Renders the source-reference list that accompanies an AI-generated artifact summary.
 * Memoized because the list only changes when a new citation arrives mid-stream.
 */
export const CitationsList = memo(function CitationsList({ citations }: CitationsListProps) {
  if (citations.length === 0) return null;

  return (
    <div data-testid="summary-citations" className="mt-6 border-t border-app-border pt-4">
      <h3 className="mb-2 text-sm font-semibold text-app-text">Sources</h3>
      <ul className="space-y-1">
        {citations.map((c, index) => (
          <li
            key={`${c.artifactId}-${index}`}
            className="flex items-center gap-2 text-sm text-app-text-muted"
          >
            <FileText className="h-4 w-4 text-app-brand" aria-hidden />
            {c.sourceUrl ? (
              <a
                href={c.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 truncate underline hover:text-app-brand"
              >
                {c.filename}
              </a>
            ) : (
              <span className="min-w-0 truncate">{c.filename}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
});
