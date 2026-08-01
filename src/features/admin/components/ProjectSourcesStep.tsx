import { useId, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { parseGithubRepositoryInput } from "../../../services/sources/githubRepositoryInput";
import { createDraftSource, type DraftSource } from "../projectSourcesDraft";
import { StagedSourceList } from "./StagedSourceList";

type ProjectSourcesStepProps = {
  sources: DraftSource[];
  tokenNames: string[];
  /** Blocks the whole step while the parent runs a connect batch. */
  disabled?: boolean;
  onAdd: (source: DraftSource) => void;
  onRemove: (sourceId: string) => void;
  /** Omitted where retrying makes no sense, e.g. before anything ran. */
  onRetry?: (sourceId: string) => void;
};

/**
 * Editor for the GitHub repositories that should be attached to a project.
 *
 * Used both as step 2 of the create-project wizard and as the "Add sources"
 * section of the project drawer, so it owns no project identity and never
 * connects anything itself — the parent holds the list and runs the batch.
 *
 * Repositories are typed in by hand. Ticket #244's `GET /api/v1/github/discover`
 * does not exist in the backend yet; when it lands, a picker can populate the
 * same list through `onAdd` without touching the rest of the flow.
 */
export function ProjectSourcesStep({
  sources,
  tokenNames,
  disabled = false,
  onAdd,
  onRemove,
  onRetry,
}: ProjectSourcesStepProps) {
  const ownerInputId = useId();
  const nameInputId = useId();
  const tokenSelectId = useId();

  const [owner, setOwner] = useState("");
  const [repositoryName, setRepositoryName] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [formError, setFormError] = useState("");

  const hasTokens = tokenNames.length > 0;
  const effectiveTokenName = tokenName || tokenNames[0] || "";

  const addSource = () => {
    const parsedRepository = parseGithubRepositoryInput(owner, repositoryName);

    if (!parsedRepository) {
      setFormError(
        "Enter a repository as owner/name, a GitHub URL, or fill in both fields.",
      );
      return;
    }

    if (!effectiveTokenName) {
      setFormError("Choose a saved GitHub access token.");
      return;
    }

    const alreadyStaged = sources.some(
      (source) =>
        source.owner.toLowerCase() === parsedRepository.owner.toLowerCase() &&
        source.name.toLowerCase() === parsedRepository.name.toLowerCase(),
    );

    if (alreadyStaged) {
      setFormError(
        `${parsedRepository.owner}/${parsedRepository.name} is already on the list.`,
      );
      return;
    }

    onAdd(
      createDraftSource(
        parsedRepository.owner,
        parsedRepository.name,
        effectiveTokenName,
      ),
    );

    setOwner("");
    setRepositoryName("");
    setFormError("");
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-app-border bg-app-surface-muted p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor={ownerInputId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              Repository owner
            </label>
            <input
              id={ownerInputId}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              disabled={disabled}
              placeholder="SprintStartProject or a GitHub URL"
              className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor={nameInputId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              Repository name
            </label>
            <input
              id={nameInputId}
              value={repositoryName}
              onChange={(event) => setRepositoryName(event.target.value)}
              disabled={disabled}
              placeholder="sprintstart-backend"
              className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor={tokenSelectId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              GitHub access token
            </label>
            <select
              id={tokenSelectId}
              value={effectiveTokenName}
              onChange={(event) => setTokenName(event.target.value)}
              disabled={disabled || !hasTokens}
              className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-colors focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {hasTokens ? (
                tokenNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              ) : (
                <option value="">No saved tokens available</option>
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={addSource}
            disabled={disabled || !hasTokens}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add repository
          </button>
        </div>

        {!hasTokens && (
          <p className="mt-3 text-sm text-app-warning-text">
            Add a GitHub personal access token first, then come back to connect
            repositories.
          </p>
        )}

        {formError && (
          <p className="mt-3 flex items-start gap-2 text-sm text-app-danger-text">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </p>
        )}
      </div>

      <StagedSourceList
        sources={sources}
        disabled={disabled}
        onRemove={onRemove}
        onRetry={onRetry}
        emptyMessage="No repositories added. You can skip this and connect sources later from the data ingestion page."
      />
    </div>
  );
}
