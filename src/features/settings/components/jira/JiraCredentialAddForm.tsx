import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { useToast } from "../../../../context/useToast";
import { parseApiError, describeRefreshFailure } from "../../../../services/apiError";
import { addJiraCredential, type JiraCredentialsDto } from "../../../../services/sources/jiraService";

type JiraCredentialAddFormProps = {
  /** Login email used only as the initial Jira account email. */
  defaultUserEmail: string | null;
  onClose: () => void;
  /** Receives the credential just added, for an optimistic list update. */
  onSaved: (credential: JiraCredentialsDto) => Promise<void>;
  /**
   * When the form is already inside a titled container (the wizard's desktop
   * companion), drop its own card chrome and header so the inputs sit directly
   * in that panel instead of a card-within-a-card.
   */
  embedded?: boolean;
};

const ADD_FALLBACK = "Failed to add Jira credential.";

/**
 * Inline form for storing a Jira account email and API token for the
 * authenticated user. The login email is only a convenience default because
 * the Jira account may use a different address.
 */
export function JiraCredentialAddForm({
  defaultUserEmail,
  onClose,
  onSaved,
  embedded = false,
}: JiraCredentialAddFormProps) {
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
        await addJiraCredential({
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
      toast.success("Jira credential added");
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
      className={
        embedded
          ? ""
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
      }
    >
      {!embedded && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="text-sm font-semibold text-app-text">New Jira credential</span>
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
        <Field label="Jira account email" controlId="settings-jira-add-email" disabled={isSaving}>
          <Input
            ref={emailInputRef}
            data-testid="settings-jira-add-email"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="jira-account@example.com"
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Credential name" controlId="settings-jira-add-name" disabled={isSaving}>
          <Input
            ref={nameInputRef}
            data-testid="settings-jira-add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. default"
            required
            maxLength={64}
          />
        </Field>

        <Field
          label="API token"
          controlId="settings-jira-add-token"
          disabled={isSaving}
          hint="The token is stored encrypted and cannot be retrieved after saving."
        >
          <Input
            data-testid="settings-jira-add-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Jira API token"
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
            data-testid="settings-jira-add-submit"
            loading={isSaving}
          >
            {isSaving ? "Adding..." : "Add credential"}
          </Button>
        </div>
      </div>
    </form>
  );
}
