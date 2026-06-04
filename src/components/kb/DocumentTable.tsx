import type { DocumentMetadata } from '../../services/types';
import { DocumentStatus } from '../../services/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileCode,
    Trash2,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    ImageIcon,
} from 'lucide-react';

interface Props {
    documents: DocumentMetadata[];
    onDelete: (id: string) => void;
}

export function DocumentTable({ documents, onDelete }: Props) {
    const getStatusBadge = (status: DocumentStatus) => {
        switch (status) {
            case DocumentStatus.COMPLETED:
                return (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-app-success-border bg-app-success-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-success-text">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready
                    </div>
                );

            case DocumentStatus.PROCESSING:
                return (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-brand-text">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Indexing
                    </div>
                );

            case DocumentStatus.PENDING:
                return (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-app-neutral-border bg-app-neutral-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-neutral-text">
                        <Clock className="h-3 w-3" />
                        Queued
                    </div>
                );

            case DocumentStatus.FAILED:
                return (
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-app-danger-border bg-app-danger-bg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-app-danger-text">
                        <AlertCircle className="h-3 w-3" />
                        Error
                    </div>
                );
        }
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                    <tr className="border-b border-app-border bg-app-surface-muted">
                        <th className="px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-app-text-disabled sm:px-6">
                            Document
                        </th>

                        <th className="px-4 py-5 text-center text-[11px] font-bold uppercase tracking-widest text-app-text-disabled sm:px-6">
                            Status
                        </th>

                        <th className="hidden px-4 py-5 text-[11px] font-bold uppercase tracking-widest text-app-text-disabled sm:px-6 md:table-cell">
                            Ingested At
                        </th>

                        <th className="px-4 py-5 text-right text-[11px] font-bold uppercase tracking-widest text-app-text-disabled sm:px-6">
                            Actions
                        </th>
                    </tr>
                    </thead>

                    <tbody className="divide-y divide-app-border">
                    <AnimatePresence mode="popLayout">
                        {documents.map((doc) => (
                            <motion.tr
                                key={doc.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="group transition-colors hover:bg-app-surface-hover"
                            >
                                <td className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center gap-2 sm:gap-4">
                                        <div className="shrink-0 rounded-lg bg-app-surface-muted p-1.5 text-app-text-subtle transition-colors group-hover:bg-app-brand-soft group-hover:text-app-brand-text sm:rounded-xl sm:p-2.5">
                                            {doc.name.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/) ? (
                                                <ImageIcon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                                            ) : (
                                                <FileCode className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                                            )}
                                        </div>

                                        <div className="flex min-w-0 flex-col">
                                                <span
                                                    className="max-w-[100px] truncate font-semibold text-app-text sm:max-w-[300px]"
                                                    title={doc.name}
                                                >
                                                    {doc.name}
                                                </span>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-4 py-4 text-center sm:px-6">
                                    {getStatusBadge(doc.status)}
                                </td>

                                <td className="hidden px-4 py-4 text-sm font-medium text-app-text-subtle sm:px-6 md:table-cell">
                                    {new Date(doc.uploadDate).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </td>

                                <td className="px-4 py-4 text-right sm:px-6">
                                    <button
                                        type="button"
                                        onClick={() => onDelete(doc.id)}
                                        className="rounded-xl p-2 text-app-text-disabled transition-all hover:bg-app-danger-bg hover:text-app-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                                        title="Remove document"
                                    >
                                        <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </AnimatePresence>

                    {documents.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-20 text-center">
                                <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
                                    <div className="rounded-full bg-app-surface-muted p-4">
                                        <FileCode className="h-10 w-10 text-app-text-disabled" />
                                    </div>

                                    <div className="space-y-1">
                                        <p className="font-semibold text-app-text">
                                            No documents indexed
                                        </p>

                                        <p className="text-sm text-app-text-subtle">
                                            Upload Markdown documentation to populate your project&apos;s knowledge base.
                                        </p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}