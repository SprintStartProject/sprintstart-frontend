import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Key, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { centralSpringToken } from '../../../styles/tokens';
import { TokenDeleteConfirm } from './TokenDeleteConfirm';
import { TokenRotateForm } from './TokenRotateForm';

type TokenRowProps = {
    name: string;
    onSaved: () => Promise<void>;
};

type Panel = 'none' | 'rotate' | 'delete';

/**
 * One row in the PAT list. Only one inline panel (rotate or delete) can be
 * open at a time. The row itself is wrapped in `motion.div` so it animates
 * in/out when added/removed from the list (AGENTS.md §11).
 */
export function TokenRow({ name, onSaved }: TokenRowProps) {
    const [panel, setPanel] = useState<Panel>('none');

    const openRotate = () => setPanel('rotate');
    const openDelete = () => setPanel('delete');
    const close = () => setPanel('none');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={centralSpringToken}
            className="border-b border-app-border last:border-b-0"
        >
            <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface-muted">
                    <Key className="h-4 w-4 text-app-text-muted" aria-hidden />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-app-text">
                        {name}
                    </p>
                    <p className="text-xs text-app-text-muted">GitHub PAT</p>
                </div>

                {panel === 'none' && (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={openRotate}
                            data-testid={`settings-rotate-open-${name}`}
                            icon={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                            className="flex-1 sm:flex-none"
                            aria-label={`Rotate token ${name}`}
                        >
                            Rotate
                        </Button>
                        <Button
                            variant="dangerSoft"
                            size="sm"
                            onClick={openDelete}
                            data-testid={`settings-delete-open-${name}`}
                            icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                            className="flex-1 sm:flex-none"
                            aria-label={`Delete token ${name}`}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            <AnimatePresence initial={false}>
                {panel === 'delete' && (
                    <motion.div
                        key="delete"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={centralSpringToken}
                    >
                        <TokenDeleteConfirm
                            name={name}
                            onClose={close}
                            onSaved={onSaved}
                        />
                    </motion.div>
                )}
                {panel === 'rotate' && (
                    <motion.div
                        key="rotate"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={centralSpringToken}
                    >
                        <TokenRotateForm
                            name={name}
                            onClose={close}
                            onSaved={onSaved}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
