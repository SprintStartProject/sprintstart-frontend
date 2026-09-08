import { AlertTriangle } from "lucide-react";
import { DropdownSelect } from "../../../components/ui/DropdownSelect.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import type { AtlassianCredentialDto } from "../../../services/sources/atlassianService.ts";

/**
 * Controlled Confluence connect form for a base URL, space ID, and a stored
 * Atlassian credential.
 *
 * Shared between the Data Ingestion "Add source" wizard and the project-creation
 * wizard so the Confluence connect experience is identical in both places.
 */
export function ConfluenceConnectStep({
  baseUrl,
  spaceId,
  credentialName,
  credentials,
  credentialsLoaded,
  credentialsLoading,
  credentialsError,
  isBusy = false,
  canIngest = true,
  ingestBlockedReason,
  errorMessage,
  onBaseUrlChange,
  onSpaceIdChange,
  onCredentialNameChange,
  onSubmit,
  suppressMissingCredentialNotice = false,
}: {
  baseUrl: string;
  spaceId: string;
  credentialName: string;
  credentials: AtlassianCredentialDto[];
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  credentialsError: string | null;
  isBusy?: boolean;
  canIngest?: boolean;
  ingestBlockedReason?: string;
  errorMessage?: string | null;
  onBaseUrlChange: (value: string) => void;
  onSpaceIdChange: (value: string) => void;
  onCredentialNameChange: (value: string) => void;
  onSubmit?: () => void;
  /**
   * Hides the built-in "no stored credential" banner. Set when the parent shows
   * its own missing-credential hint (e.g. the wizard's compact notice next to
   * its inline "Add credential" button) so the message is not duplicated.
   */
  suppressMissingCredentialNotice?: boolean;
}) {
  const hasCredentials = credentials.length > 0;
  const showNoCredentials =
    credentialsLoaded && !credentialsLoading && !hasCredentials && !suppressMissingCredentialNotice;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      {!canIngest && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          {ingestBlockedReason ?? "You can only connect sources to projects you manage."}
        </div>
      )}

      {showNoCredentials && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          No Atlassian credentials are stored for your account. Add one under Settings, Access
          Tokens, Atlassian first, then come back to connect.
        </div>
      )}

      <Field label="Confluence base URL" controlId="confluence-base-url" disabled={isBusy}>
        <Input
          data-testid="confluence-base-url"
          type="url"
          value={baseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          placeholder="https://your-domain.atlassian.net"
          required
        />
      </Field>

      <Field
        label="Space ID"
        controlId="confluence-space-id"
        disabled={isBusy}
        hint="Numeric ID of the space in Confluence Cloud."
      >
        <Input
          data-testid="confluence-space-id"
          type="text"
          inputMode="numeric"
          pattern="[0-9]+"
          value={spaceId}
          onChange={(event) => onSpaceIdChange(event.target.value)}
          placeholder="e.g. 123456"
          required
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
