import type { DocumentMetadata } from '../../../services/types';
import { DocumentStatus } from '../../../services/types';
import { motion, AnimatePresence } from 'framer-motion';
import { FileCode, Trash2, CheckCircle2, Clock, AlertCircle, Loader2, ImageIcon } from 'lucide-react';

interface Props {
    documents: DocumentMetadata[];
    onDelete: (id: string) => void;
}

export function DocumentTable({ documents, onDelete }: Props) {
    const getStatusBadge = (status: DocumentStatus) => {
        switch (status) {
            case DocumentStatus.COMPLETED:
                return (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                    </div>
                );
            case DocumentStatus.PROCESSING:
                return (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Indexing
                    </div>
                );
            case DocumentStatus.PENDING:
                return (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                        <Clock className="w-3 h-3" />
                        Queued
                    </div>
                );
            case DocumentStatus.FAILED:
                return (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertCircle className="w-3 h-3" />
                        Error
                    </div>
                );
        }
    };

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800">
                            <th className="px-4 sm:px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Document</th>
                            <th className="px-4 sm:px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                            <th className="px-4 sm:px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">Ingested At</th>
                            <th className="px-4 sm:px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        <AnimatePresence mode='popLayout'>
                            {documents.map((doc) => (
                                <motion.tr
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hover:bg-slate-800/30 transition-colors group"
                                >
                                    <td className="px-4 sm:px-6 py-4">
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <div className="p-1.5 sm:p-2.5 bg-slate-800 text-slate-400 rounded-lg sm:rounded-xl group-hover:text-blue-400 group-hover:bg-blue-400/10 transition-colors shrink-0">
                                                {doc.name.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/) ? (
                                                    <ImageIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                                ) : (
                                                    <FileCode className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-white truncate max-w-[100px] sm:max-w-[300px]" title={doc.name}>
                                                    {doc.name}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-center">
                                        {getStatusBadge(doc.status)}
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-slate-400 hidden md:table-cell">
                                        {new Date(doc.uploadDate).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-right">
                                        <button
                                            onClick={() => onDelete(doc.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all focus-visible:focus-outline outline-none"
                                            title="Remove document"
                                            aria-label={`Remove document: ${doc.name}`}
                                        >
                                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                        {documents.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                                        <div className="p-4 bg-slate-800/50 rounded-full">
                                            <FileCode className="w-10 h-10 text-slate-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-white font-semibold">No documents indexed</p>
                                            <p className="text-slate-400 text-sm">Upload Markdown documentation to populate your project&apos;s knowledge base.</p>
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
