import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import {
  parseApiError,
  describeRefreshFailure,
} from "../../../../services/apiError";
import { addJiraCredential } from "../../../../services/sources/jiraService";

type JiraCredentialAddFormProps = {
  /**
   * Jira account email the credential is stored under — chosen at the section
   * level (the "Jira account email" scope), not necessarily the login email.
   */
  userEmail: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const ADD_FALLBACK = "Failed to add Jira credential.";

/**
 * Inline "Add Jira credential" form. Unlike a GitHub PAT there is no fixed token
 * prefix to validate client-side, so the token is only required, not
 * format-checked. The credential is keyed by `(userEmail, tokenName)`; the
 * account email is fixed by the section's editable scope (shown here for
 * confirmation) so an added credential always lands in the list being viewed.
 * A ref guard prevents double-submit before the disabled state re-renders.
 */
export function JiraCredentialAddForm({
  userEmail,
  onClose,
  onSaved,
}: JiraCredentialAddFormProps) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    setError("");
    try {
      try {
        await addJiraCredential({
          userEmail,
          tokenName: name.trim(),
          authToken: token.trim(),
        });
      } catch (mutationError) {
        setError(parseApiError(mutationError, ADD_FALLBACK));
        return;
      }
      // Mutation succeeded — a failed refetch still closes the form since
      // server state is correct; surface a distinct "couldn't refresh" note.
      try {
        await onSaved();
      } catch (refreshError) {
        setError(describeRefreshFailure(refreshError));
        return;
      }
      onClose();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add Jira credential"
      className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-app-text">
            New Jira credential
          </span>
          <p
            className="mt-0.5 break-words text-xs text-app-text-muted"
            data-testid="settings-jira-add-account"
          >
            for {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSaving}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
          aria-label="Cancel add credential"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="settings-jira-add-name"
            className="mb-1.5 block text-xs font-medium text-app-text-muted"
          >
            Credential name
          </label>
          <input
            ref={nameInputRef}
            id="settings-jira-add-name"
            data-testid="settings-jira-add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. default"
            required
            maxLength={64}
            disabled={isSaving}
            className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="settings-jira-add-token"
            className="mb-1.5 block text-xs font-medium text-app-text-muted"
          >
            API token
          </label>
          <input
            id="settings-jira-add-token"
            data-testid="settings-jira-add-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Jira API token"
            required
            autoComplete="off"
            disabled={isSaving}
            className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
          />
          <p className="mt-1.5 text-xs text-app-text-subtle">
            The token is stored encrypted and cannot be retrieved after saving.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-app-danger-text">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-5 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="settings-jira-add-submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Adding...
              </>
            ) : (
              "Add credential"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
