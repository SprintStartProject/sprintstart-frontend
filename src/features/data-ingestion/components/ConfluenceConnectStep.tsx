import { AlertTriangle } from "lucide-react";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";

/**
 * Controlled Confluence connect form for base URL, space ID, and credentials.
 *
 * Shared between the Data Ingestion "Add source" wizard and the project-creation
 * wizard so the Confluence connect experience is identical in both places.
 */
export function ConfluenceConnectStep({
  baseUrl,
  spaceId,
  email,
  apiToken,
  isBusy = false,
  canIngest = true,
  ingestBlockedReason,
  errorMessage,
  onBaseUrlChange,
  onSpaceIdChange,
  onEmailChange,
  onApiTokenChange,
  onSubmit,
}: {
  baseUrl: string;
  spaceId: string;
  email: string;
  apiToken: string;
  isBusy?: boolean;
  canIngest?: boolean;
  ingestBlockedReason?: string;
  errorMessage?: string | null;
  onBaseUrlChange: (value: string) => void;
  onSpaceIdChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onApiTokenChange: (value: string) => void;
  onSubmit?: () => void;
}) {
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

      <Field label="Account email" controlId="confluence-email" disabled={isBusy}>
        <Input
          data-testid="confluence-email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="user@example.com"
          required
          autoComplete="email"
        />
      </Field>

      <Field
        label="API token"
        controlId="confluence-api-token"
        disabled={isBusy}
        hint="The token is stored encrypted and cannot be retrieved after saving."
      >
        <Input
          data-testid="confluence-api-token"
          type="password"
          value={apiToken}
          onChange={(event) => onApiTokenChange(event.target.value)}
          placeholder="Atlassian API token"
          required
          autoComplete="off"
        />
      </Field>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </form>
  );
}
