import { AlertTriangle } from "lucide-react";

import { DropdownSelect } from "../../../components/ui/DropdownSelect.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
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
  const hasCredentials = credentials.length > 0;
  const showNoCredentials = credentialsLoaded && !credentialsLoading && !hasCredentials;

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
          {ingestBlockedReason ?? "You can only connect sources to projects you manage."}
        </div>
      )}

      {showNoCredentials && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          No Jira credentials are stored for your account. Add one under Settings, Access Tokens,
          Jira first, then come back to connect.
        </div>
      )}
      <Field label="Display name" controlId="jira-display-name" disabled={isBusy}>
        <Input
          data-testid="jira-display-name"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder="e.g. Team board"
        />
      </Field>

      <Field label="Instance URL" controlId="jira-instance-url" disabled={isBusy}>
        <Input
          data-testid="jira-instance-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://your-domain.atlassian.net"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-app-text">Credential</span>
        <DropdownSelect
          label="Credential"
          value={credentialName}
          options={
            hasCredentials
              ? credentials.map((credential) => ({
                  value: credential.displayName,
                  label: `${credential.displayName} - ${credential.userEmail}`,
                }))
              : [
                  {
                    value: "",
                    label: credentialsLoading ? "Loading credentials..." : "No credentials",
                  },
                ]
          }
          onChange={onCredentialNameChange}
          disabled={isBusy || !hasCredentials}
        />
      </div>
      <p className="text-xs text-app-text-subtle">
        Jira account emails are stored with each credential. Manage them under Settings, Access
        Tokens, Jira.
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
