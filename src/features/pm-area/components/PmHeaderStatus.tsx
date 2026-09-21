import { AlertTriangle, CheckCircle2, Database, FolderKanban, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchIngestionSources } from "../../data-ingestion/ingestionSources";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { useProjectContext } from "../../projects/useProjectContext";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { queryKeys } from "../../../services/queryKeys";

const chipClassName =
  "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium";

/**
 * The header's right edge: which project the whole area is showing, and whether the knowledge
 * behind it is fresh.
 *
 * Both are true of every section alike, which is what earns them a place in the one header that
 * never changes (section controls stay in their sections — see `PmWorkspace`). The sync chip
 * answers the question the ingestion card at the bottom of the overview used to be scrolled to
 * for: can the buddy's answers, the gaps and the questions be trusted right now? It reads the
 * same cache entry as that card and the Data Ingestion page, so all three agree.
 */
export function PmHeaderStatus() {
  const { selectedProject, selectedProjectId } = useProjectContext();
  const { data: sources } = useQueryFetch(
    queryKeys.ingestion.sourceStatuses(selectedProjectId),
    () => fetchIngestionSources(selectedProjectId),
    { enabled: Boolean(selectedProjectId) },
  );

  if (!selectedProjectId) return null;

  const errors = sources?.reduce((sum, source) => sum + source.errors, 0) ?? 0;
  const syncing = sources?.some((source) => source.statusView.state === "syncing") ?? false;
  const lastRunAt =
    sources
      ?.map((source) => source.lastRunAt)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ?? null;

  const sync = !sources
    ? null
    : sources.length === 0
      ? {
          icon: Database,
          label: "No sources connected",
          tone: "border-app-border bg-app-surface text-app-text-muted",
        }
      : syncing
        ? {
            icon: RefreshCw,
            label: "Syncing knowledge…",
            tone: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
          }
        : errors > 0
          ? {
              icon: AlertTriangle,
              label: errors === 1 ? "1 sync error" : `${errors} sync errors`,
              tone: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
            }
          : {
              icon: CheckCircle2,
              label: lastRunAt ? `Synced ${formatRelativeDate(lastRunAt)}` : "Not synced yet",
              tone: "border-app-success-border bg-app-success-bg text-app-success-text",
            };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {selectedProject?.name && (
        <span
          className={`${chipClassName} border-app-border bg-app-surface text-app-text`}
          title="The project this dashboard shows — switch it in the sidebar"
        >
          <FolderKanban aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-app-brand-text" />
          <span className="truncate">{selectedProject.name}</span>
        </span>
      )}
      {sync && (
        <Link
          to="/data-ingestion"
          title="Data ingestion"
          className={`${chipClassName} ${sync.tone} transition-colors hover:border-app-brand-border-strong focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none`}
        >
          <sync.icon
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          <span className="truncate">{sync.label}</span>
        </Link>
      )}
    </div>
  );
}
