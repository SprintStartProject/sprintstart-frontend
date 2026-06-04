import { useState, useEffect, useCallback } from 'react';
import { knowledgeService } from '../features/data-ingestion/api/knowledgeService';
import { type DocumentMetadata, DocumentStatus } from '../services/types';
import { FileUploadZone } from '../features/data-ingestion/components/FileUploadZone';
import { DocumentTable } from '../features/data-ingestion/components/DocumentTable';
import { useAuth } from '../context/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, RefreshCw, AlertTriangle, CheckCircle2, X } from 'lucide-react';

export function DataIngestionPage() {
    const { profile } = useAuth();
    const [documents, setDocuments] = useState<DocumentMetadata[]>(() => {
        // Hydrate from sessionStorage on initial load
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

    // Save to sessionStorage whenever documents change
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
                    // Create a map of existing pending documents to preserve them
                    const pendingDocs = prev.filter(d => d.status === DocumentStatus.PENDING);
                    
                    // Filter out any docs that the server just returned (to avoid duplicates)
                    const filteredPending = pendingDocs.filter(
                        p => !docs.some(d => d.id === p.id)
                    );

                    // Combine server docs with remaining local pending docs
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
            } else {
                if (isMounted) setIsLoading(false);
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

            // Add successful uploads to the table immediately as "PENDING"
            // Filter out duplicates (if file already exists in current list or multiple times in batch)
            const newDocs: DocumentMetadata[] = [];
            successfulResults.forEach(r => {
                const isDuplicate = documents.some(d => d.id === r.id) || newDocs.some(d => d.id === r.id);
                if (!isDuplicate) {
                    const originalFile = files.find(f => f.name === r.filename);
                    newDocs.push({
                        id: r.id,
                        name: r.filename,
                        mime: originalFile?.type || 'application/octet-stream',
                        size: originalFile?.size || 0,
                        status: DocumentStatus.PENDING,
                        uploadDate: new Date().toISOString()
                    });
                }
            });

            if (newDocs.length > 0) {
                setDocuments(prev => [...newDocs, ...prev]);
            }

            // Set batch feedback
            setBatchResult({
                success: successfulResults.length,
                failed: failedResults.length,
                errors: failedResults.map(r => `${r.filename}: ${r.error}`)
            });

            // Auto-clear success notification after 5 seconds, keep errors
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
        <div className="min-h-screen bg-gray-950 p-3 sm:p-6 lg:p-10 text-white">
            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-10">
                {/* Header */}
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 sm:p-2 bg-blue-600/20 rounded-lg">
                            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                        </div>
                        <motion.h1 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xl sm:text-3xl font-bold tracking-tight"
                        >
                            Knowledge Base
                        </motion.h1>
                    </div>
                    <motion.p 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-400 max-w-2xl text-sm sm:text-lg leading-relaxed"
                    >
                        Ingest project documentation. Upload Markdown files to provide context for your workspace.
                    </motion.p>
                </header>

                {/* Batch Feedback */}
                <AnimatePresence>
                    {batchResult && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            role="status"
                            aria-live="polite"
                            className={`p-4 rounded-xl border flex flex-col gap-2 ${
                                batchResult.failed > 0 
                                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-200' 
                                    : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-3">
                                    {batchResult.failed > 0 ? (
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    )}
                                    Upload Complete: {batchResult.success} documents ingested, {batchResult.failed} failed
                                </span>
                                <button 
                                    onClick={() => setBatchResult(null)}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors focus-visible:focus-outline outline-none"
                                    aria-label="Close notification"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                            {batchResult.errors.length > 0 && (
                                <ul className="text-sm list-disc list-inside mt-2 space-y-1 pl-8 text-amber-200/80">
                                    {batchResult.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col gap-10">
                    {/* Top: Upload */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full"
                    >
                        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-white">Ingest Documentation</h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    Select .md files to add them to the knowledge base.
                                </p>
                            </div>
                            
                            <FileUploadZone 
                                onUpload={(files) => { void handleUpload(files); }} 
                                isUploading={isUploading} 
                            />
                        </div>
                    </motion.div>

                    {/* Bottom: List */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-6"
                    >
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                Knowledge Repository
                                {documents.length > 0 && (
                                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                        {documents.length} Docs
                                    </span>
                                )}
                            </h2>
                            <button 
                                onClick={() => { void loadDocuments(); }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all focus-visible:focus-outline outline-none"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="h-64 flex items-center justify-center bg-slate-900 rounded-2xl border border-slate-800">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-slate-400 text-sm font-medium animate-pulse">Syncing repository...</p>
                                </div>
                            </div>
                        ) : (
                            <DocumentTable 
                                documents={documents} 
                                onDelete={(id) => { void handleDelete(id); }} 
                            />
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
