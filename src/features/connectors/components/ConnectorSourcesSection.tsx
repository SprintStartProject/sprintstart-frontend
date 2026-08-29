import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { useToast } from "../../../context/useToast.ts";
import { connectorService } from "../../../services/connectorService.ts";
import { buildSourceKey } from "../data.ts";
import { ConfluenceConnectStep } from "./ConfluenceConnectStep.tsx";
import { useConfluenceSync } from "./useConfluenceSync.ts";
import type {
  ConnectorListItem,
  ConnectorSourceRow,
  DraftSourceChanges,
  LoadingState,
} from "../types.ts";

type ConnectorSourcesSectionProps = {
  connector: ConnectorListItem;
  /** Scopes the source list to a project (backend `projectId` filter). */
  projectId?: string | null;
  onSourcesSaved?: () => void;
};

const EMPTY_DRAFT: DraftSourceChanges = {
  sourceKey: "",
  changedSourceIds: new Set<string>(),
};

/**
 * Inline (accordion-style) section for viewing and updating the in-scope
 * sources (allowlist/denylist) of a single connector. Rendered directly
 * inside the connector's card in `ConnectorList` when expanded. Each source
 * has a boolean "enabled" state - enabled sources are in scope (allowed),
 * disabled sources are excluded (denied). Toggles are staged locally as a
 * draft and committed in a single batched `PATCH .../sources/status` call.
 */
export function ConnectorSourcesSection({
  connector,
  projectId,
  onSourcesSaved,
}: ConnectorSourcesSectionProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sources, setSources] = useState<ConnectorSourceRow[]>([]);
  const [loadedConnectorId, setLoadedConnectorId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSourceChanges>(EMPTY_DRAFT);
  const [saveState, setSaveState] = useState<LoadingState>("idle");
  const [query, setQuery] = useState("");
  const [isAddingConfluence, setIsAddingConfluence] = useState(false);
  const toast = useToast();
  const { syncConnection, syncingId } = useConfluenceSync(projectId);
  const isConfluence = connector.id === "confluence";

  const sourceKey = useMemo(() => buildSourceKey(sources), [sources]);

  const activeDraft = draft.sourceKey === sourceKey ? draft : EMPTY_DRAFT;

  const retryLoadSources = () => {
    setLoadingState("loading");
    setErrorMessage(null);

    connectorService
      .getConnectorSources(connector.id, projectId ?? undefined)
      .then((response) => {
        setSources(response.sources);
        setLoadedConnectorId(connector.id);
        setLoadingState("success");
      })
      .catch((error: unknown) => {
        setLoadedConnectorId(connector.id);
        setLoadingState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load sources");
      });
  };

  useEffect(() => {
    let isMounted = true;

    void connectorService
      .getConnectorSources(connector.id, projectId ?? undefined)
      .then((response) => {
        if (!isMounted) return;

        setSources(response.sources);
        setLoadedConnectorId(connector.id);
        setErrorMessage(null);
        setLoadingState("success");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setLoadedConnectorId(connector.id);
        setLoadingState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load sources");
      });

    return () => {
      isMounted = false;
    };
  }, [connector.id, projectId]);

  const hasLoadedSelectedConnector = loadedConnectorId === connector.id;

  const draftSources = useMemo<ConnectorSourceRow[]>(() => {
    return sources.map((source) =>
      activeDraft.changedSourceIds.has(source.id)
        ? { ...source, enabled: !source.enabled }
        : source,
    );
  }, [sources, activeDraft.changedSourceIds]);

  const hasPendingChanges = activeDraft.changedSourceIds.size > 0;

  const toggleSource = (sourceId: string) => {
    setDraft((current) => {
      const isCurrentDraft = current.sourceKey === sourceKey;
      const changedSourceIds = new Set(isCurrentDraft ? current.changedSourceIds : []);

      if (changedSourceIds.has(sourceId)) {
        changedSourceIds.delete(sourceId);
      } else {
        changedSourceIds.add(sourceId);
      }

      return { sourceKey, changedSourceIds };
    });
    setSaveState("idle");
  };

  const discardChanges = () => {
    setDraft(EMPTY_DRAFT);
    setSaveState("idle");
  };

  const saveChanges = async () => {
    if (!hasPendingChanges) return;

    setSaveState("loading");

    const patches = draftSources
      .filter((source) => activeDraft.changedSourceIds.has(source.id))
      .map((source) => ({ sourceId: source.id, enabled: source.enabled }));

    try {
      const response = await connectorService.patchConnectorSources(connector.id, patches);

      setSources(response.sources);
      setDraft(EMPTY_DRAFT);
      setSaveState("success");
      toast.success("Sources updated");
      onSourcesSaved?.();
    } catch (error) {
      // The batch update may have persisted on the backend even though
      // this request failed (e.g. the DB write succeeds but the
      // follow-up AI-service sync throws, surfacing as a 500). Refetch
      // the current sources to find out whether that's the case,
      // instead of assuming the change was lost.
      try {
        const refreshed = await connectorService.getConnectorSources(
          connector.id,
          projectId ?? undefined,
        );
        const matchesIntendedState = patches.every(
          (patch) =>
            refreshed.sources.find((source) => source.id === patch.sourceId)?.enabled ===
            patch.enabled,
        );

        setSources(refreshed.sources);
        setDraft(EMPTY_DRAFT);

        if (matchesIntendedState) {
          setSaveState("success");
          toast.warning("Sources updated", {
            description:
              "Confirming the change with the AI service failed, but the in-scope list above is up to date.",
          });
          onSourcesSaved?.();
        } else {
          setSaveState("error");
          toast.error(error instanceof Error ? error.message : "Couldn't update the sources.");
        }
      } catch {
        // Could not confirm the true state either - fall back to a
        // plain failure and keep the draft so nothing is lost.
        setSaveState("error");
        toast.error(error instanceof Error ? error.message : "Couldn't update the sources.");
      }
    }
  };

  const isLoading = loadingState === "loading" || !hasLoadedSelectedConnector;
  const isSaving = saveState === "loading";
  const changeCount = activeDraft.changedSourceIds.size;
  const inScopeCount = draftSources.filter((source) => source.enabled).length;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSources = normalizedQuery
    ? draftSources.filter(
        (source) =>
          source.name.toLowerCase().includes(normalizedQuery) ||
          source.url.toLowerCase().includes(normalizedQuery),
      )
    : draftSources;

  return (
    <div className="mt-4 space-y-4 border-t border-app-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-app-text">Sources</p>

        <div className="flex items-center gap-2">
          {isConfluence && projectId && !isAddingConfluence && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsAddingConfluence(true)}
            >
              Add space
            </Button>
          )}

          {!isLoading && draftSources.length > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-app-border bg-app-bg-soft px-2.5 py-1 text-xs font-medium text-app-text-muted tabular-nums">
              {inScopeCount} / {draftSources.length} in scope
            </span>
          )}
        </div>
      </div>

      {isAddingConfluence && projectId && (
        <ConfluenceConnectStep
          projectId={projectId}
          onClose={() => setIsAddingConfluence(false)}
          onSaved={() => {
            retryLoadSources();
            onSourcesSaved?.();
          }}
        />
      )}

      {hasLoadedSelectedConnector && errorMessage && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          <p>{errorMessage}</p>

          <Button variant="secondary" size="sm" onClick={retryLoadSources} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface-muted p-4 text-sm text-app-text-muted">
          <RefreshCw size={16} className="animate-spin text-app-brand" />
          Loading sources...
        </div>
      )}

      {!isLoading && draftSources.length === 0 && !errorMessage && (
        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-6 text-center text-sm text-app-text-muted">
          No sources are connected to this connector yet.
        </div>
      )}

      {!isLoading && draftSources.length > 0 && (
        <>
          {draftSources.length > 5 && (
            <Input
              size="sm"
              icon={<Search className="h-4 w-4" />}
              aria-label="Search sources"
              placeholder="Search sources…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}

          <div className="space-y-2">
            {filteredSources.map((source) => {
              const isChanged = activeDraft.changedSourceIds.has(source.id);

              return (
                <div
                  key={source.id}
                  className={[
                    "flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                    isChanged
                      ? "border-app-brand-border-strong bg-app-brand-soft"
                      : "border-app-border bg-app-surface-muted",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-app-text">{source.name}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-app-text-muted hover:text-app-brand-text"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{source.url}</span>
                    </a>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isConfluence && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={syncingId === source.id}
                        disabled={syncingId !== null}
                        onClick={() =>
                          // TODO(issue #6): source.id must be the same UUID as
                          // ConfluenceConnectionDto.id from the connections endpoint.
                          // Verify that GET /connectors/confluence/sources returns
                          // connection UUIDs before removing this comment.
                          void syncConnection(source.id, () => {
                            retryLoadSources();
                            onSourcesSaved?.();
                          })
                        }
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                      >
                        Sync now
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      aria-pressed={source.enabled}
                      aria-label={
                        source.enabled
                          ? `Exclude ${source.name} from ingestion`
                          : `Include ${source.name} in ingestion`
                      }
                      className={[
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        source.enabled
                          ? "border-app-success-border bg-app-success-bg text-app-success-text hover:bg-app-success-solid hover:text-white"
                          : // Red like every other "disabled" marker in the app, so the
                            // excluded state reads the same here as on the source cards.
                            "border-app-danger-border bg-app-danger-bg text-app-danger-text hover:bg-app-danger-solid hover:text-white",
                      ].join(" ")}
                    >
                      {source.enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {source.enabled ? "In scope" : "Excluded"}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredSources.length === 0 && (
              <p className="py-6 text-center text-sm text-app-text-muted">
                No sources match your search.
              </p>
            )}
          </div>
        </>
      )}

      {hasPendingChanges && (
        <div className="flex items-center justify-between gap-3 border-t border-app-border pt-3">
          <p className="text-xs font-medium text-app-text-muted tabular-nums">
            {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
          </p>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={discardChanges} disabled={isSaving}>
              Discard
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                void saveChanges();
              }}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : `Save ${changeCount} change${changeCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
