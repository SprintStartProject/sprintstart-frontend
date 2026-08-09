import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { parseApiError, describeRefreshFailure } from '../../../services/apiError';
import { addGithubPat } from '../../../services/sources/githubService';
import { INVALID_TOKEN_MESSAGE, isValidGithubPat } from '../utils/patValidation';

type TokenAddFormProps = {
    onClose: () => void;
    onSaved: () => Promise<void>;
};

/**
 * Inline "Add GitHub PAT" form. Validates the token prefix client-side before
 * submitting. A ref guard prevents double-submit even if Enter fires before
 * the disabled state re-renders.
 */
export function TokenAddForm({ onClose, onSaved }: TokenAddFormProps) {
    const [name, setName] = useState('');
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

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
        setError('');
        try {
            try {
                await addGithubPat(trimmedName, trimmedToken);
            } catch (mutationError) {
                setError(parseApiError(mutationError, INVALID_TOKEN_MESSAGE));
                return;
            }
            // Mutation succeeded — closing now; if the refetch fails we surface
            // a distinct message but still close the form (server state is correct).
            try {
                await onSaved();
            } catch (refreshError) {
                setError(describeRefreshFailure(refreshError));
                return;
            }
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
            className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-4 sm:p-5"
        >
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

            <div className="space-y-3">
                <div>
                    <label
                        htmlFor="settings-add-token-name"
                        className="mb-1.5 block text-xs font-medium text-app-text-muted"
                    >
                        Token name
                    </label>
                    <input
                        ref={nameInputRef}
                        id="settings-add-token-name"
                        data-testid="settings-add-token-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. default"
                        required
                        maxLength={64}
                        disabled={isSaving}
                        className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
                    />
                </div>

                <div>
                    <label
                        htmlFor="settings-add-token-value"
                        className="mb-1.5 block text-xs font-medium text-app-text-muted"
                    >
                        Token (ghp_...)
                    </label>
                    <input
                        id="settings-add-token-value"
                        data-testid="settings-add-token-value"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_... or github_pat_..."
                        required
                        autoComplete="off"
                        disabled={isSaving}
                        className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
                    />
                    <p className="mt-1.5 text-xs text-app-text-subtle">
                        The token value is stored encrypted and cannot be retrieved after saving.
                    </p>
                </div>

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
                        {isSaving ? 'Adding...' : 'Add Token'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
