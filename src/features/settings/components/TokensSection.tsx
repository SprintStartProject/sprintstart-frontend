import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { centralSpringToken } from '../../../styles/tokens';
import { useGithubTokens } from '../hooks/useGithubTokens';
import { TokenAddForm } from './TokenAddForm';
import { TokenRow } from './TokenRow';

/**
 * GitHub Personal Access Token management for the user-settings page.
 *
 * Independent copy of the Access Management PAT UI (per story) that calls the
 * same backend endpoints — PATs are global today, so this shows and edits the
 * same tokens as the admin panel. Behaviour is intentionally identical.
 *
 * Mutation state lives in {@link useGithubTokens}; this component only renders
 * the list and delegates add/rotate/delete to the sub-components. The token
 * list is wrapped in `<AnimatePresence>` so rows animate in/out (AGENTS.md §11).
 */
export function TokensSection() {
    const { tokenNames, tokensLoaded, tokensError, loadTokenNames, isRefreshing } =
        useGithubTokens();

    const [isAddOpen, setIsAddOpen] = useState(false);

    const showInitialLoading = !tokensLoaded && isRefreshing;
    const busy = isRefreshing;

    const handleSaved = async () => {
        await loadTokenNames();
    };

    return (
        <div
            className="space-y-4"
            aria-busy={busy}
            aria-live="polite"
            aria-label="GitHub access tokens"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-app-text">
                        {tokenNames.length}{' '}
                        {tokenNames.length === 1 ? 'token' : 'tokens'}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        iconOnly
                        onClick={() => void loadTokenNames()}
                        disabled={isRefreshing}
                        data-testid="settings-tokens-refresh"
                        aria-label="Refresh tokens"
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            aria-hidden
                        />
                    </Button>
                </div>

                {!isAddOpen && (
                    <Button
                        variant="primary"
                        onClick={() => setIsAddOpen(true)}
                        data-testid="settings-add-token-open"
                        icon={<Plus className="h-4 w-4" aria-hidden />}
                        className="w-full sm:w-auto"
                    >
                        Add Token
                    </Button>
                )}
            </div>

            {showInitialLoading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-app-brand" aria-hidden />
                    <span className="sr-only">Loading tokens...</span>
                </div>
            )}

            {!showInitialLoading && tokensError && (
                <div
                    role="alert"
                    className="rounded-xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
                    data-testid="settings-tokens-error"
                >
                    {tokensError}
                </div>
            )}

            {!showInitialLoading && (
                <>
                    <AnimatePresence initial={false}>
                        {isAddOpen && (
                            <motion.div
                                key="add-form"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={centralSpringToken}
                            >
                                <TokenAddForm
                                    onClose={() => setIsAddOpen(false)}
                                    onSaved={handleSaved}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {tokenNames.length === 0 && !isAddOpen ? (
                        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface p-8">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <Key className="h-8 w-8 text-app-text-disabled" aria-hidden />
                                <div>
                                    <p className="text-base font-medium text-app-text">
                                        No tokens yet
                                    </p>
                                    <p className="mt-1 text-sm text-app-text-muted">
                                        Add a GitHub Personal Access Token to enable repository
                                        ingestion.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        tokenNames.length > 0 && (
                            <ul
                                className="overflow-hidden rounded-2xl border border-app-border bg-app-surface"
                                aria-label="Stored GitHub access tokens"
                            >
                                <AnimatePresence initial={false}>
                                    {tokenNames.map((name) => (
                                        <li key={name}>
                                            <TokenRow name={name} onSaved={handleSaved} />
                                        </li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                        )
                    )}
                </>
            )}
        </div>
    );
}
