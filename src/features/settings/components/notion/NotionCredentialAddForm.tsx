import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { useToast } from "../../../../context/useToast";
import { describeRefreshFailure } from "../../../../services/apiError";
import {
  addNotionCredential,
  type NotionCredentialDto,
} from "../../../../services/sources/notionService";
import { describeNotionCredentialError } from "./notionCredentialErrors";

type NotionCredentialAddFormProps = {
  onClose: () => void;
  /**
   * Receives the credential the backend returned (workspace name included), for an
   * optimistic list update.
   */
  onSaved: (credential: NotionCredentialDto) => Promise<void>;
  /**
   * When the form is already inside a titled container (the wizard's desktop
   * companion), drop its own card chrome and header so the inputs sit directly
   * in that panel instead of a card-within-a-card.
   */
  embedded?: boolean;
};

const ADD_FALLBACK = "Failed to add Notion credential.";

/**
 * Inline form for storing a Notion token for the authenticated user. The
 * credential name is the only key, so there is no email field. The backend
 * checks the token and answers with the workspace it belongs to; the hint
 * reminds users that connecting indexes everything the token can see in Notion.
 */
export function NotionCredentialAddForm({
  onClose,
  onSaved,
  embedded = false,
}: NotionCredentialAddFormProps) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const toast = useToast();

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

    const trimmedName = name.trim();

    savingRef.current = true;
    setIsSaving(true);
    try {
      let saved: NotionCredentialDto;
      try {
        saved = await addNotionCredential({ name: trimmedName, token: token.trim() });
      } catch (mutationError) {
        // Keep the form open so the user can correct the input.
        toast.error(describeNotionCredentialError(mutationError, ADD_FALLBACK));
        return;
      }
      try {
        await onSaved(saved);
      } catch (refreshError) {
        toast.warning(describeRefreshFailure(refreshError));
        onClose();
        return;
      }
      toast.success("Notion credential added");
      onClose();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add Notion credential"
      className={
        embedded
          ? ""
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
      }
    >
      {!embedded && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-app-text">New Notion credential</span>
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
          label="Credential name"
          controlId="settings-notion-add-name"
          required
          disabled={isSaving}
        >
          <Input
            ref={nameInputRef}
            data-testid="settings-notion-add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. team-wiki"
            required
            maxLength={64}
          />
        </Field>

        <Field
          label="Notion token"
          controlId="settings-notion-add-token"
          required
          disabled={isSaving}
          hint="The token is stored encrypted and cannot be retrieved after saving. Connecting indexes every page the token can see in Notion."
        >
          <Input
            data-testid="settings-notion-add-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Notion token"
            required
            autoComplete="off"
          />
        </Field>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            data-testid="settings-notion-add-submit"
            loading={isSaving}
          >
            {isSaving ? "Adding..." : "Add credential"}
          </Button>
        </div>
      </div>
    </form>
  );
}
