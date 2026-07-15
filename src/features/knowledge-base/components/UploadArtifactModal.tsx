import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FileUploadZone } from './FileUploadZone';
import { knowledgeService } from '../../../services/knowledgeService';

/**
 * Props for the UploadArtifactModal component.
 */
interface UploadArtifactModalProps {
    isOpen: boolean;
    /** Closes the modal and resets upload state in the parent. */
    onClose: () => void;
    /** Project scope the uploaded files will be ingested into. */
    projectId: string;
}

/**
 * UploadArtifactModal
 * 
 * Orchestrates the batch upload process of user documents into the knowledge base.
 * Provides feedback on success or failure for each individual file ingested.
 */
export function UploadArtifactModal({ isOpen, onClose, projectId }: UploadArtifactModalProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [batchResult, setBatchResult] = useState<{
        success: number;
        failed: number;
        errors: string[];
    } | null>(null);

    /**
     * Submits the selected files to the backend for ingestion.
     * Parses the batch results to display per-file success/error states.
     */
    const handleUpload = async (files: File[]) => {
        setIsUploading(true);
        setBatchResult(null);

        try {
            const results = await knowledgeService.uploadDocuments(projectId, files);
            
            const successfulResults = results.filter((r) => r.status === 'success');
            const failedResults = results.filter((r) => r.status === 'error');

            setBatchResult({
                success: successfulResults.length,
                failed: failedResults.length,
                errors: failedResults.map((r) => `${r.filename}: ${r.error}`),
            });

            // Close automatically after success, or leave open if errors
            if (failedResults.length === 0) {
                setTimeout(() => {
                    setBatchResult(null);
                    onClose();
                }, 2000);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            setBatchResult({
                success: 0,
                failed: files.length,
                errors: ['Upload failed due to a network or server error.'],
            });
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-x-0 top-0 h-screen z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl rounded-2xl bg-app-bg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
                    <h2 className="text-xl font-semibold text-app-text">Upload Artifacts</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus:outline-none focus:ring-2 focus:ring-app-focus"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <p className="text-sm text-app-text-subtle">
                            Select or drag and drop .md, .pdf, or image files to add them to the knowledge base.
                        </p>

                        <FileUploadZone
                            onUpload={(files) => {
                                void handleUpload(files);
                            }}
                            isUploading={isUploading}
                        />

                        <AnimatePresence>
                            {batchResult && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div
                                        className={`mt-4 flex flex-col gap-2 rounded-xl border p-4 ${
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
                                                Upload Complete: {batchResult.success} ingested, {batchResult.failed} failed
                                            </span>
                                        </div>

                                        {batchResult.errors.length > 0 && (
                                            <ul className="mt-2 list-inside list-disc space-y-1 pl-8 text-sm text-app-warning-text">
                                                {batchResult.errors.map((err, i) => (
                                                    <li key={`${i}-${err.slice(0, 20)}`}>{err}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
