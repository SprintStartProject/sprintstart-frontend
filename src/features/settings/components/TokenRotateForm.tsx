import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { parseApiError, describeRefreshFailure } from '../../../services/apiError';
import { updateGithubPat } from '../../../services/sources/githubService';
import { INVALID_TOKEN_MESSAGE, isValidGithubPat } from '../utils/patValidation';

type TokenRotateFormProps = {
    name: string;
    onClose: () => void;
    onSaved: () => Promise<void>;
};

/**
 * Inline "rotate token" form for one PAT row. Validates the new token prefix
 * client-side and guards against double-submit.
 */
export function TokenRotateForm({ name, onClose, onSaved }: TokenRotateFormProps) {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleClose = () => {
        if (savingRef.current) return;
        onClose();
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (savingRef.current) return;

        const trimmed = token.trim();
        if (!isValidGithubPat(trimmed)) {
            setError(INVALID_TOKEN_MESSAGE);
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        setError('');
        try {
            try {
                await updateGithubPat(name, trimmed);
            } catch (mutationError) {
                setError(parseApiError(mutationError, INVALID_TOKEN_MESSAGE));
                return;
            }
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
            aria-label={`Rotate token ${name}`}
            className="border-t border-app-brand-border bg-app-brand-soft px-4 py-4 sm:px-5"
        >
            <p className="mb-3 text-sm font-semibold text-app-text">Rotate token</p>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="min-w-0 flex-1">
                    <label
                        htmlFor="settings-rotate-token-value"
                        className="mb-1.5 block text-xs font-medium text-app-text-muted"
                    >
                        New GitHub PAT
                    </label>
                    <div className="relative">
                        <RefreshCw
                            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled"
                            aria-hidden
                        />
                        <input
                            ref={inputRef}
                            id="settings-rotate-token-value"
                            data-testid={`settings-rotate-token-${name}`}
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_... or github_pat_..."
                            required
                            autoComplete="off"
                            disabled={isSaving}
                            className="h-11 w-full rounded-xl border border-app-brand-border bg-app-surface pl-11 pr-4 text-sm font-medium text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:opacity-60"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 xl:flex xl:shrink-0">
                    <Button
                        variant="primary"
                        type="submit"
                        data-testid={`settings-rotate-submit-${name}`}
                        loading={isSaving}
                        icon={<RefreshCw className="h-4 w-4" aria-hidden />}
                    >
                        {isSaving ? 'Rotating...' : 'Confirm'}
                    </Button>

                    <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
                        Cancel
                    </Button>
                </div>
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm text-app-danger-text">
                    {error}
                </p>
            )}
        </form>
    );
}
