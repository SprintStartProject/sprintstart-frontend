import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { parseApiError, describeRefreshFailure } from '../../../services/apiError';
import { deleteGithubPat } from '../../../services/sources/githubService';

type TokenDeleteConfirmProps = {
    name: string;
    onClose: () => void;
    onSaved: () => Promise<void>;
};

/**
 * Inline delete-confirmation panel for one PAT row. Guards double-submit and
 * surfaces a distinct message when the deletion succeeded but the list
 * refetch failed.
 */
export function TokenDeleteConfirm({
    name,
    onClose,
    onSaved,
}: TokenDeleteConfirmProps) {
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const deletingRef = useRef(false);

    const confirmRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        confirmRef.current?.focus();
    }, []);

    const handleClose = () => {
        if (deletingRef.current) return;
        onClose();
    };

    const handleConfirm = async () => {
        if (deletingRef.current) return;
        deletingRef.current = true;
        setIsDeleting(true);
        setError('');
        try {
            try {
                await deleteGithubPat(name);
            } catch (mutationError) {
                setError(parseApiError(mutationError, 'Failed to delete token.'));
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
            deletingRef.current = false;
            setIsDeleting(false);
        }
    };

    return (
        <div className="border-t border-app-border bg-app-danger-bg px-5 py-4">
            <p className="mb-3 text-sm text-app-danger-text">
                Delete <strong>{name}</strong>? This cannot be undone and may break
                connected repositories.
            </p>
            {error && (
                <p role="alert" className="mb-2 text-sm text-app-danger-text">
                    {error}
                </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    ref={confirmRef}
                    variant="danger"
                    size="sm"
                    onClick={() => void handleConfirm()}
                    data-testid={`settings-delete-confirm-${name}`}
                    loading={isDeleting}
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleClose}
                    disabled={isDeleting}
                >
                    Cancel
                </Button>
            </div>
        </div>
    );
}
