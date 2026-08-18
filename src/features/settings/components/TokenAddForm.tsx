import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { useToast } from "../../../context/useToast";
import { parseApiError, describeRefreshFailure } from "../../../services/apiError";
import { addGithubPat } from "../../../services/sources/githubService";
import { INVALID_TOKEN_MESSAGE, isValidGithubPat } from "../utils/patValidation";

type TokenAddFormProps = {
  onClose: () => void;
  onSaved: () => Promise<void>;
  /**
   * When the form is already inside a titled container (the wizard's desktop
   * companion), drop its own card chrome and header so the inputs sit directly
   * in that panel instead of a card-within-a-card.
   */
  embedded?: boolean;
};

/**
 * Inline "Add GitHub PAT" form. Validates the token prefix client-side before
 * submitting. A ref guard prevents double-submit even if Enter fires before
 * the disabled state re-renders.
 */
export function TokenAddForm({ onClose, onSaved, embedded = false }: TokenAddFormProps) {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  // `error` holds the inline messages shown next to the inputs: the client-side
  // format check and the post-save refresh failure. Server-side mutation
  // failures (e.g. a name clash) are surfaced as toasts instead.
  const [error, setError] = useState("");
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
    const trimmedToken = token.trim();
    if (!isValidGithubPat(trimmedToken)) {
      setError(INVALID_TOKEN_MESSAGE);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError("");
    try {
      try {
        await addGithubPat(trimmedName, trimmedToken);
      } catch (mutationError) {
        // Server-side failures (e.g. a name clash) surface as a toast; the
        // inline error is reserved for the client-side format check above.
        toast.error(parseApiError(mutationError, "Failed to add GitHub token."));
        return;
      }
      try {
        await onSaved();
      } catch (refreshError) {
        setError(describeRefreshFailure(refreshError));
        return;
      }
      toast.success("GitHub token added");
      onClose();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add GitHub PAT"
      className={
        embedded
          ? ""
          : "overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
      }
    >
      {!embedded && (
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-app-text">New GitHub PAT</span>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Cancel add token"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <Field label="Token name" controlId="settings-add-token-name" disabled={isSaving}>
          <Input
            ref={nameInputRef}
            data-testid="settings-add-token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. default"
            required
            maxLength={64}
          />
        </Field>

        <Field
          label="Token (ghp_...)"
          controlId="settings-add-token-value"
          hint="The token value is stored encrypted and cannot be retrieved after saving."
          disabled={isSaving}
        >
          <Input
            data-testid="settings-add-token-value"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_... or github_pat_..."
            required
            autoComplete="off"
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-app-danger-text">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            data-testid="settings-add-token-submit"
            loading={isSaving}
          >
            {isSaving ? "Adding..." : "Add Token"}
          </Button>
        </div>
      </div>
    </form>
  );
}
