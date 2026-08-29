import { useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button.tsx";
import { Field } from "../../../components/ui/Field.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { useToast } from "../../../context/useToast.ts";
import { parseApiError } from "../../../services/apiError.ts";
import {
  confluenceService,
  type ConfluenceConnectionDto,
} from "../../../services/sources/confluenceService.ts";

type ConfluenceConnectStepProps = {
  projectId: string;
  onClose: () => void;
  onSaved: (connection: ConfluenceConnectionDto) => void;
};

const ADD_FALLBACK = "Failed to connect Confluence space.";

/**
 * Inline form for creating a new Confluence Cloud space connection inside
 * the Connectors modal.
 */
export function ConfluenceConnectStep({ projectId, onClose, onSaved }: ConfluenceConnectStepProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const toast = useToast();

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    const trimmedBaseUrl = baseUrl.trim();
    const trimmedSpaceId = spaceId.trim();
    const trimmedEmail = email.trim();
    const trimmedToken = apiToken.trim();

    if (!trimmedBaseUrl || !trimmedSpaceId || !trimmedEmail || !trimmedToken) {
      toast.error("Please fill in all required fields.");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);

    try {
      const created = await confluenceService.createConnection(projectId, {
        baseUrl: trimmedBaseUrl,
        spaceId: trimmedSpaceId,
        email: trimmedEmail,
        apiToken: trimmedToken,
        pageAllowlist: [],
        pageDenylist: [],
      });

      toast.success("Confluence space connected", {
        description: `Connected space key: ${created.spaceKey}`,
      });
      onSaved(created);
      onClose();
    } catch (error) {
      toast.error(parseApiError(error, ADD_FALLBACK));
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

        <Field label="Account email" controlId="connectors-confluence-email" disabled={isSaving}>
          <Input
            data-testid="connectors-confluence-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field
          label="API token"
          controlId="connectors-confluence-token"
          disabled={isSaving}
          hint="The token is stored encrypted and cannot be retrieved after saving."
        >
          <Input
            data-testid="connectors-confluence-token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Atlassian API token"
            required
            autoComplete="off"
          />
        </Field>

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
          >
            {isSaving ? "Connecting..." : "Connect space"}
          </Button>
        </div>
      </div>
    </form>
  );
}
