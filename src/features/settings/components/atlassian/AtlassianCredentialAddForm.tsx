import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { useToast } from "../../../../context/useToast";
import { parseApiError, describeRefreshFailure } from "../../../../services/apiError";
import {
  addAtlassianCredential,
  type AtlassianCredentialDto,
} from "../../../../services/sources/atlassianService";

type AtlassianCredentialAddFormProps = {
  /** Login email used only as the initial Atlassian account email. */
  defaultUserEmail: string | null;
  onClose: () => void;
  /** Receives the credential just added, for an optimistic list update. */
  onSaved: (credential: AtlassianCredentialDto) => Promise<void>;
  /**
   * When the form is already inside a titled container (the wizard's desktop
   * companion), drop its own card chrome and header so the inputs sit directly
   * in that panel instead of a card-within-a-card.
   */
  embedded?: boolean;
};

const ADD_FALLBACK = "Failed to add Atlassian credential.";

/**
 * Inline form for storing an Atlassian account email and API token for the
 * authenticated user, shared by the Jira and Confluence connectors. The login
 * email is only a convenience default because the Atlassian account may use a
 * different address.
 */
export function AtlassianCredentialAddForm({
  defaultUserEmail,
  onClose,
  onSaved,
  embedded = false,
}: AtlassianCredentialAddFormProps) {
  const [userEmail, setUserEmail] = useState(defaultUserEmail ?? "");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const toast = useToast();

  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (defaultUserEmail) {
      nameInputRef.current?.focus();
    } else {
      emailInputRef.current?.focus();
    }
  }, [defaultUserEmail]);

  const handleClose = () => {
    if (savingRef.current) return;
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;

    const trimmedEmail = userEmail.trim();
    const trimmedName = name.trim();

    savingRef.current = true;
    setIsSaving(true);
    try {
      try {
        await addAtlassianCredential({
          userEmail: trimmedEmail,
          tokenName: trimmedName,
          authToken: token.trim(),
        });
      } catch (mutationError) {
        // Keep the form open so the user can correct the input.
        toast.error(parseApiError(mutationError, ADD_FALLBACK));
        return;
      }
      try {
        await onSaved({ userEmail: trimmedEmail, displayName: trimmedName });
      } catch (refreshError) {
        toast.warning(describeRefreshFailure(refreshError));
        onClose();
        return;
      }
      toast.success("Atlassian credential added");
      onClose();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add Atlassian credential"
      className={
        embedded
          ? ""
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
      }
    >
      {!embedded && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-app-text">New Atlassian credential</span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Cancel add credential"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <Field
          label="Atlassian account email"
          controlId="settings-atlassian-add-email"
          disabled={isSaving}
        >
          <Input
            ref={emailInputRef}
            data-testid="settings-atlassian-add-email"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="atlassian-account@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Credential name" controlId="settings-atlassian-add-name" disabled={isSaving}>
          <Input
            ref={nameInputRef}
            data-testid="settings-atlassian-add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. default"
            required
            maxLength={64}
          />
        </Field>

        <Field
          label="API token"
          controlId="settings-atlassian-add-token"
          disabled={isSaving}
          hint="The token is stored encrypted and cannot be retrieved after saving."
        >
          <Input
            data-testid="settings-atlassian-add-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Atlassian API token"
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex flex-row justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            data-testid="settings-atlassian-add-submit"
            loading={isSaving}
          >
            {isSaving ? "Adding..." : "Add credential"}
          </Button>
        </div>
      </div>
    </form>
  );
}
