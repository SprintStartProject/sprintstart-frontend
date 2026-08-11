import { AlertTriangle } from "lucide-react";

import type { JiraCredentialsDto } from "../../../services/sources/jiraService.ts";

/**
 * Jira connect form for an instance URL and a credential owned by the
 * authenticated user. The selected credential supplies its Jira account email.
 *
 * Shared between the Data Ingestion "Add source" wizard and the project-creation
 * wizard so the Jira connect experience is identical in both places.
 */
export function JiraConnectStep({
  displayName,
  url,
  credentialName,
  credentials,
  credentialsLoaded,
  credentialsLoading,
  credentialsError,
  isBusy,
  canIngest,
  ingestBlockedReason,
  errorMessage,
  onDisplayNameChange,
  onUrlChange,
  onCredentialNameChange,
  onSubmit,
}: {
  displayName: string;
  url: string;
  credentialName: string;
  credentials: JiraCredentialsDto[];
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  credentialsError: string | null;
  isBusy: boolean;
  canIngest: boolean;
  ingestBlockedReason?: string;
  errorMessage: string | null;
  onDisplayNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onCredentialNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const fieldClassName =
    "mt-2 h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none transition placeholder:text-app-text-disabled focus:border-app-brand disabled:cursor-not-allowed disabled:opacity-60";

  const hasCredentials = credentials.length > 0;
  const showNoCredentials =
    credentialsLoaded && !credentialsLoading && !hasCredentials;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {!canIngest && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          {ingestBlockedReason ??
            "You can only connect sources to projects you manage."}
        </div>
      )}

      {showNoCredentials && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          No Jira credentials are stored for your account. Add one under
          Settings, Access Tokens, Jira first, then come back to connect.
        </div>
      )}
      <div>
        <label
          htmlFor="jira-display-name"
          className="text-sm font-medium text-app-text"
        >
          Display name
        </label>
        <input
          id="jira-display-name"
          data-testid="jira-display-name"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          disabled={isBusy}
          placeholder="e.g. Team board"
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="jira-instance-url"
          className="text-sm font-medium text-app-text"
        >
          Instance URL
        </label>
        <input
          id="jira-instance-url"
          data-testid="jira-instance-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={isBusy}
          placeholder="https://your-domain.atlassian.net"
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="jira-credential"
          className="text-sm font-medium text-app-text"
        >
          Credential
        </label>
        <select
          id="jira-credential"
          data-testid="jira-credential"
          value={credentialName}
          onChange={(event) => onCredentialNameChange(event.target.value)}
          disabled={isBusy || !hasCredentials}
          className="mt-2 h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition focus:border-app-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {hasCredentials ? (
            credentials.map((credential) => (
              <option
                key={credential.displayName}
                value={credential.displayName}
              >
                {credential.displayName} - {credential.userEmail}
              </option>
            ))
          ) : (
            <option value="">
              {credentialsLoading ? "Loading credentials..." : "No credentials"}
            </option>
          )}
        </select>
      </div>
      <p className="text-xs text-app-text-subtle">
        Jira account emails are stored with each credential. Manage them under
        Settings, Access Tokens, Jira.
      </p>
      {credentialsError && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{credentialsError}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </form>
  );
}
