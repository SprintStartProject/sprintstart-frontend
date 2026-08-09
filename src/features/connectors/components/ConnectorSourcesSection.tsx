import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { connectorService } from "../../../services/connectorService.ts";
import { buildSourceKey } from "../data.ts";
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
  const [loadedConnectorId, setLoadedConnectorId] = useState<string | null>(
    null,
  );
  const [draft, setDraft] = useState<DraftSourceChanges>(EMPTY_DRAFT);
  const [saveState, setSaveState] = useState<LoadingState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveMessageTone, setSaveMessageTone] = useState<"error" | "warning">(
    "error",
  );

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
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load sources",
        );
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
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load sources",
        );
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
      const changedSourceIds = new Set(
        isCurrentDraft ? current.changedSourceIds : [],
      );

      if (changedSourceIds.has(sourceId)) {
        changedSourceIds.delete(sourceId);
      } else {
        changedSourceIds.add(sourceId);
      }

      return { sourceKey, changedSourceIds };
    });
    setSaveState("idle");
    setSaveErrorMessage(null);
    setSaveMessageTone("error");
  };

  const discardChanges = () => {
    setDraft(EMPTY_DRAFT);
    setSaveState("idle");
    setSaveErrorMessage(null);
    setSaveMessageTone("error");
  };

  const saveChanges = async () => {
    if (!hasPendingChanges) return;

    setSaveState("loading");
    setSaveErrorMessage(null);

    const patches = draftSources
      .filter((source) => activeDraft.changedSourceIds.has(source.id))
      .map((source) => ({ sourceId: source.id, enabled: source.enabled }));

    try {
      const response = await connectorService.patchConnectorSources(
        connector.id,
        patches,
      );

      setSources(response.sources);
      setDraft(EMPTY_DRAFT);
      setSaveState("success");
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
            refreshed.sources.find((source) => source.id === patch.sourceId)
              ?.enabled === patch.enabled,
        );

        setSources(refreshed.sources);
        setDraft(EMPTY_DRAFT);

        if (matchesIntendedState) {
          setSaveState("success");
          setSaveMessageTone("warning");
          setSaveErrorMessage(
            "Sources were updated, but confirming the change with the AI service failed. The in-scope list shown above is up to date.",
          );
          onSourcesSaved?.();
        } else {
          setSaveState("error");
          setSaveMessageTone("error");
          setSaveErrorMessage(
            error instanceof Error ? error.message : "Failed to update sources",
          );
        }
      } catch {
        // Could not confirm the true state either - fall back to a
        // plain failure and keep the draft so nothing is lost.
        setSaveState("error");
        setSaveMessageTone("error");
        setSaveErrorMessage(
          error instanceof Error ? error.message : "Failed to update sources",
        );
      }
    }
  };

  const isLoading = loadingState === "loading" || !hasLoadedSelectedConnector;
  const isSaving = saveState === "loading";

  return (
    <div className="space-y-4 border-t border-app-border pt-4">
      <div>
        <p className="text-sm font-semibold text-app-text">Sources</p>
        <p className="mt-1 text-xs text-app-text-muted">
          Toggle which sources are in scope for this connector. Changes are
          batched and only applied when you save.
        </p>
      </div>

      {hasLoadedSelectedConnector && errorMessage && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          <p>{errorMessage}</p>

          <Button
            variant="secondary"
            size="sm"
            onClick={retryLoadSources}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="rounded-xl border border-app-border bg-app-surface-muted p-4">
          <div className="flex items-center gap-3 text-sm text-app-text-muted">
            <RefreshCw size={16} className="animate-spin text-app-brand" />
            Loading sources...
          </div>
        </div>
      )}

      {!isLoading && draftSources.length === 0 && !errorMessage && (
        <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted p-6 text-center text-sm text-app-text-muted">
          No sources are connected to this connector yet.
        </div>
      )}

      {!isLoading && draftSources.length > 0 && (
        <div className="space-y-3">
          {draftSources.map((source) => {
            const isChanged = activeDraft.changedSourceIds.has(source.id);

            return (
              <div
                key={source.id}
                className={[
                  "flex items-center justify-between gap-3 rounded-xl border p-4",
                  isChanged
                    ? "border-app-brand-border-strong bg-app-brand-soft"
                    : "border-app-border bg-app-surface-muted",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-app-text">
                    {source.name}
                  </p>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 truncate text-xs text-app-text-muted hover:text-app-brand-text"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{source.url}</span>
                  </a>
                </div>

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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    source.enabled
                      ? "border-app-success-border bg-app-success-bg text-app-success-text hover:bg-app-success-solid hover:text-white"
                      // Red like every other "disabled" marker in the app, so the
                      // excluded state reads the same here as on the source cards.
                      : "border-app-danger-border bg-app-danger-bg text-app-danger-text hover:bg-app-danger-solid hover:text-white",
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
            );
          })}
        </div>
      )}

      {saveErrorMessage && (
        <div
          className={
            saveMessageTone === "warning"
              ? "rounded-2xl border border-app-success-border bg-app-success-bg px-4 py-3 text-sm text-app-success-text"
              : "rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text"
          }
        >
          {saveErrorMessage}
        </div>
      )}

      {hasPendingChanges && (
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={discardChanges}
            disabled={isSaving}
            className="flex-1"
          >
            Discard
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              void saveChanges();
            }}
            loading={isSaving}
            className="flex-1"
          >
            {isSaving
              ? "Saving..."
              : `Save ${activeDraft.changedSourceIds.size} change${activeDraft.changedSourceIds.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  );
}
