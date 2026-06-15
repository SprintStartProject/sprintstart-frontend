import { useState, useEffect, useCallback } from 'react';
import { knowledgeService } from '../services/knowledgeService';
import { type DocumentMetadata, DocumentStatus } from '../services/types';
import { FileUploadZone } from '../components/kb/FileUploadZone';
import { DocumentTable } from '../components/kb/DocumentTable';
import { useAuth } from '../context/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    X,
} from 'lucide-react';

export function KnowledgeBasePage() {
    const { profile } = useAuth();

    const [documents, setDocuments] = useState<DocumentMetadata[]>(() => {
        const saved = sessionStorage.getItem(`kb_docs_${profile?.id || 'guest'}`);

        return saved ? JSON.parse(saved) as DocumentMetadata[] : [];
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const [batchResult, setBatchResult] = useState<{
        success: number;
        failed: number;
        errors: string[];
    } | null>(null);

    useEffect(() => {
        if (profile) {
            sessionStorage.setItem(`kb_docs_${profile.id}`, JSON.stringify(documents));
        }
    }, [documents, profile]);

    const loadDocuments = useCallback(async (isMounted = true) => {
        if (!profile) return;

        try {
            const docs = await knowledgeService.fetchDocuments(profile.id);

            if (isMounted) {
                setDocuments(prev => {
                    const pendingDocs = prev.filter(d => d.status === DocumentStatus.PENDING);

                    const filteredPending = pendingDocs.filter(
                        p => !docs.some(d => d.id === p.id),
                    );

                    return [...docs, ...filteredPending];
                });
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        } finally {
            if (isMounted) setIsLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            if (profile) {
                await loadDocuments(isMounted);
            } else if (isMounted) {
                setIsLoading(false);
            }
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, [profile, loadDocuments]);

    const handleUpload = async (files: File[]) => {
        if (!profile) return;

        setIsUploading(true);
        setBatchResult(null);

        try {
            const results = await knowledgeService.uploadDocuments(files, profile.id);

            const successfulResults = results.filter(r => r.status === 'ok');
            const failedResults = results.filter(r => r.status === 'failed');

            const newDocs: DocumentMetadata[] = [];

            successfulResults.forEach(r => {
                const isDuplicate =
                    documents.some(d => d.id === r.id) ||
                    newDocs.some(d => d.id === r.id);

                if (!isDuplicate) {
                    const originalFile = files.find(f => f.name === r.filename);

                    newDocs.push({
                        id: r.id,
                        name: r.filename,
                        mime: originalFile?.type || 'application/octet-stream',
                        size: originalFile?.size || 0,
                        status: DocumentStatus.PENDING,
                        uploadDate: new Date().toISOString(),
                    });
                }
            });

            if (newDocs.length > 0) {
                setDocuments(prev => [...newDocs, ...prev]);
            }

            setBatchResult({
                success: successfulResults.length,
                failed: failedResults.length,
                errors: failedResults.map(r => `${r.filename}: ${r.error}`),
            });

            if (failedResults.length === 0) {
                setTimeout(() => setBatchResult(null), 5000);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await knowledgeService.deleteDocument(id);
            setDocuments(prev => prev.filter(doc => doc.id !== id));
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    return (
        <div className="min-h-screen bg-app-bg p-3 text-app-text sm:p-6 lg:p-10">
            <div className="mx-auto max-w-6xl space-y-6 sm:space-y-10">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-app-brand-soft p-1.5 sm:p-2">
                            <BookOpen className="h-5 w-5 text-app-brand-text sm:h-6 sm:w-6" />
                        </div>

                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xl font-bold tracking-tight text-app-text sm:text-3xl"
                        >
                            Knowledge Base
                        </motion.h1>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="max-w-2xl text-sm leading-relaxed text-app-text-subtle sm:text-lg"
                    >
                        Ingest project documentation. Upload Markdown files to provide context for your workspace.
                    </motion.p>
                </header>

                <AnimatePresence>
                    {batchResult && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`flex flex-col gap-2 rounded-xl border p-4 ${
                                batchResult.failed > 0
                                    ? 'border-app-warning-border bg-app-warning-bg text-app-warning-text'
                                    : 'border-app-success-border bg-app-success-bg text-app-success-text'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-3 font-semibold">
                                    {batchResult.failed > 0 ? (
                                        <AlertTriangle className="h-5 w-5 text-app-warning-text" />
                                    ) : (
                                        <CheckCircle2 className="h-5 w-5 text-app-success-text" />
                                    )}

                                    Upload Complete: {batchResult.success} documents ingested, {batchResult.failed} failed
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setBatchResult(null)}
                                    className="rounded-lg p-1 text-app-text-subtle transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {batchResult.errors.length > 0 && (
                                <ul className="mt-2 list-inside list-disc space-y-1 pl-8 text-sm text-app-warning-text">
                                    {batchResult.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full"
                    >
                        <div className="space-y-6 rounded-2xl border border-app-border bg-app-surface p-8 shadow-xl">
                            <div>
                                <h2 className="text-xl font-semibold text-app-text">
                                    Ingest Documentation
                                </h2>

                                <p className="mt-1 text-sm text-app-text-subtle">
                                    Select .md files to add them to the knowledge base.
                                </p>
                            </div>

                            <FileUploadZone
                                onUpload={(files) => {
                                    void handleUpload(files);
                                }}
                                isUploading={isUploading}
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-between px-2">
                            <h2 className="flex items-center gap-3 text-xl font-semibold text-app-text">
                                Knowledge Repository

                                {documents.length > 0 && (
                                    <span className="rounded-full bg-app-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                        {documents.length} Docs
                                    </span>
                                )}
                            </h2>

                            <button
                                type="button"
                                onClick={() => {
                                    void loadDocuments();
                                }}
                                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-app-text-subtle transition-all hover:bg-app-surface-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex h-64 items-center justify-center rounded-2xl border border-app-border bg-app-surface">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-app-brand border-t-transparent" />

                                    <p className="animate-pulse text-sm font-medium text-app-text-disabled">
                                        Syncing repository...
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <DocumentTable
                                documents={documents}
                                onDelete={(id) => {
                                    void handleDelete(id);
                                }}
                            />
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}