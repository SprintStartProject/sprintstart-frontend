import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { DropdownSelect } from "../../../components/ui/DropdownSelect.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { useToast } from "../../../context/useToast.ts";
import { ApiError } from "../../../services/apiClient.ts";
import { parseApiError } from "../../../services/apiError.ts";
import {
  confluenceService,
  type ConfluenceConnectionDto,
} from "../../../services/sources/confluenceService.ts";
import { useAtlassianCredentials } from "../../settings/hooks/useAtlassianCredentials.ts";

type ConfluenceConnectStepProps = {
  projectId: string;
  onClose: () => void;
  onSaved: (connection: ConfluenceConnectionDto) => void;
};

const ADD_FALLBACK = "Failed to connect Confluence space.";

/**
 * Inline form for creating a new Confluence Cloud space connection inside
 * the Connectors modal, backed by a stored Atlassian credential instead of a
 * raw email/token pair.
 */
export function ConfluenceConnectStep({ projectId, onClose, onSaved }: ConfluenceConnectStepProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [credentialName, setCredentialName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const toast = useToast();

  const {
    credentials,
    loaded: credentialsLoaded,
    isRefreshing: credentialsLoading,
  } = useAtlassianCredentials();
  const hasCredentials = credentials.length > 0;

  // Adopt the first stored credential once the list arrives, keeping a
  // still-valid choice — there is no host wizard here to do it instead.
  useEffect(() => {
    if (!credentialsLoaded || credentialsLoading) return;

    void Promise.resolve().then(() => {
      setCredentialName((current) => {
        if (credentials.length === 0) return "";
        return current && credentials.some((credential) => credential.displayName === current)
          ? current
          : credentials[0].displayName;
      });
    });
  }, [credentials, credentialsLoaded, credentialsLoading]);

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    const trimmedBaseUrl = baseUrl.trim();
    const trimmedSpaceId = spaceId.trim();

    if (!trimmedBaseUrl || !trimmedSpaceId || !credentialName) {
      toast.error("Please fill in all required fields.");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const created = await confluenceService.createConnection(projectId, {
        baseUrl: trimmedBaseUrl,
        spaceId: trimmedSpaceId,
        credentialName,
        pageAllowlist: [],
        pageDenylist: [],
      });

      toast.success("Confluence space connected", {
        description: `Connected space: ${created.spaceName ?? created.spaceKey}`,
      });
      onSaved(created);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.error("That credential no longer exists. Pick another one and try again.");
      } else {
        toast.error(parseApiError(error, ADD_FALLBACK));
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Connect Confluence space"
      className="mb-4 overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-app-text">Connect Confluence space</span>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={handleClose}
          disabled={isSaving}
          aria-label="Cancel connect space"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <Field
          label="Confluence base URL"
          controlId="connectors-confluence-url"
          disabled={isSaving}
        >
          <Input
            data-testid="connectors-confluence-url"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://your-domain.atlassian.net"
            required
          />
        </Field>

        <Field
          label="Space ID"
          controlId="connectors-confluence-space-id"
          disabled={isSaving}
          hint="Numeric ID of the space in Confluence Cloud."
        >
          <Input
            data-testid="connectors-confluence-space-id"
            type="text"
            inputMode="numeric"
            pattern="[0-9]+"
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
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
            onChange={setCredentialName}
            disabled={isSaving || !hasCredentials}
          />
        </div>

        <div className="flex flex-row justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            data-testid="connectors-confluence-submit"
            loading={isSaving}
            disabled={!hasCredentials}
          >
            {isSaving ? "Connecting..." : "Connect space"}
          </Button>
        </div>
      </div>
    </form>
  );
}
