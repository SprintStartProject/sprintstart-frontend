import { useCallback, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getGithubPatNames } from "../../../services/sources/githubService";
import {
  addDraftSource,
  connectDraftSources,
  countUnconnectedSources,
  hasFailedSources,
  removeDraftSource,
  type DraftSource,
} from "../projectSourcesDraft";
import { ProjectSourcesStep } from "./ProjectSourcesStep";

type AddProjectSourcesSectionProps = {
  projectId: string;
  disabled?: boolean;
  /** Called after a batch in which at least one repository connected. */
  onSourcesConnected?: () => void;
};

/**
 * Lets a project manager attach GitHub repositories to a project they manage.
 *
 * Shares `ProjectSourcesStep` with the create-project wizard; the difference is
 * that the project already exists here, so connecting is its own action rather
 * than part of a create. It deliberately stays outside the drawer's unified
 * dirty-state footer: connecting kicks off backend ingestion and cannot be
 * discarded, so folding it into "unsaved changes" would misdescribe it.
 */
export function AddProjectSourcesSection({
  projectId,
  disabled = false,
  onSourcesConnected,
}: AddProjectSourcesSectionProps) {
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [tokenNames, setTokenNames] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const loadTokenNames = useCallback(async () => {
    try {
      setTokenNames(await getGithubPatNames());
    } catch {
      setTokenNames([]);
    }
  }, []);

  useEffect(() => {
    // Deferred so this is not a synchronous state update in the effect body,
    // which `react-hooks/set-state-in-effect` rejects.
    void Promise.resolve().then(loadTokenNames);
  }, [loadTokenNames]);

  const pendingCount = countUnconnectedSources(sources);

  const connectSources = async (sourcesToConnect: DraftSource[]) => {
    setIsConnecting(true);
    setStatusMessage("");

    try {
      const result = await connectDraftSources(
        projectId,
        sourcesToConnect,
        (progressSources) =>
          setSources((current) =>
            current.map(
              (currentSource) =>
                progressSources.find(
                  (progressSource) => progressSource.id === currentSource.id,
                ) ?? currentSource,
            ),
          ),
      );

      if (result.some((source) => source.status === "connected")) {
        onSourcesConnected?.();
      }

      setStatusMessage(
        hasFailedSources(result)
          ? "Some repositories could not be connected. Retry them below."
          : "Repositories connected. Initial ingestion is running in the background.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const retrySource = (sourceId: string) => {
    const source = sources.find((current) => current.id === sourceId);
    if (!source) return;

    void connectSources([source]);
  };

  const isBusy = disabled || isConnecting;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
        Add sources
      </p>

      <ProjectSourcesStep
        sources={sources}
        tokenNames={tokenNames}
        disabled={isBusy}
        onAdd={(source) =>
          setSources((current) => addDraftSource(current, source))
        }
        onRemove={(sourceId) =>
          setSources((current) => removeDraftSource(current, sourceId))
        }
        onRetry={retrySource}
      />

      {statusMessage && (
        <p className="mt-3 text-sm text-app-text-muted">{statusMessage}</p>
      )}

      {pendingCount > 0 && (
        <Button
          variant="primary"
          onClick={() => void connectSources(sources)}
          disabled={isBusy}
          loading={isConnecting}
          icon={
            hasFailedSources(sources) ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )
          }
          className="mt-4"
        >
          Connect {pendingCount} {pendingCount === 1 ? "repository" : "repositories"}
        </Button>
      )}
    </div>
  );
}
