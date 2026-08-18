import { useEffect, useState } from "react";
import { Spinner } from "../../../components/ui/Spinner";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText } from "lucide-react";
import { knowledgeService } from "../../../services/knowledgeService";
import { useAuth } from "../../../context/useAuth";
import type { Artifact } from "../../knowledge-base/types";

const PREVIEW_COUNT = 4;

/** "3 days ago" style label, kept short enough for a dense card. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));

  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * Preview of the project's most recent knowledge base artifacts, linking
 * through to the full page.
 */
export function KnowledgeBaseWidget() {
  const { profile } = useAuth();
  const projectId = profile?.projectIds?.[0] ?? null;

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadArtifacts() {
      if (!projectId) {
        if (isCurrentRequest) setLoading(false);
        return;
      }

      const data = await knowledgeService.getRecentArtifacts(projectId, PREVIEW_COUNT);

      if (!isCurrentRequest) return;

      setArtifacts(data);
      setLoading(false);
    }

    void loadArtifacts();

    return () => {
      isCurrentRequest = false;
    };
  }, [projectId]);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -left-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-app-text">Knowledge base</span>
        </div>

        <Link
          to="/knowledge-base"
          className="flex shrink-0 items-center gap-1 rounded-lg text-xs font-medium text-app-text-muted transition-colors hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Browse
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : artifacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-sm text-app-text-muted">
            Nothing here yet — sources appear once your project has been ingested.
          </p>
        </div>
      ) : (
        <ul className="relative flex-1 space-y-1">
          {artifacts.map((artifact) => (
            <li key={artifact.id}>
              <Link
                to="/knowledge-base"
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-app-surface-hover"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />

                <span className="min-w-0 flex-1 truncate text-sm text-app-text">
                  {artifact.title ?? "Untitled"}
                </span>

                <span className="shrink-0 text-[11px] text-app-text-muted tabular-nums">
                  {formatRelative(artifact.ingestedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
