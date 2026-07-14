import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCode, Loader2, AlertCircle, ImageIcon } from 'lucide-react';

/**
 * Props for the FileUploadZone component.
 */
interface Props {
    /** Callback function triggered when one or more valid files are dropped or selected. */
    onUpload: (files: File[]) => void;
    /** Disables interactions and shows a processing spinner when true. */
    isUploading: boolean;
}

/**
 * An interactive drag-and-drop zone for uploading project artifacts.
 * 
 * Supports both manual file selection and drag-and-drop. It includes 
 * client-side validation for file types (PDF, MD, TXT, PNG, JPG, WEBP) 
 * and a 10MB size limit per file.
 */
export function FileUploadZone({ onUpload, isUploading }: Props) {
    const [isDragActive, setIsDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFiles = (files: FileList | File[]): File[] => {
        const allowedTypes = [
            'application/pdf',
            'text/markdown',
            'text/plain',
            'image/png',
            'image/jpeg',
            'image/webp',
        ];

        const maxSize = 10 * 1024 * 1024;
        const validFiles: File[] = [];
        let hasError = false;

        Array.from(files).forEach(file => {
            const isMd = file.name.toLowerCase().endsWith('.md');

            if (!allowedTypes.includes(file.type) && !isMd) {
                setError(
                    `File type not supported: ${file.name}. Only PDF, MD, TXT, PNG, JPG, and WEBP are allowed.`,
                );
                hasError = true;
            } else if (file.size > maxSize) {
                setError(`File too large: ${file.name}. Max size is 10MB.`);
                hasError = true;
            } else {
                validFiles.push(file);
            }
        });

        if (!hasError) {
            setError(null);
        }

        return validFiles;
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        const files = e.dataTransfer.files;

        if (files && files.length > 0) {
            const validFiles = validateFiles(files);

            if (validFiles.length > 0) {
                onUpload(validFiles);
            }
        }
    }, [onUpload]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;

        if (files && files.length > 0) {
            const validFiles = validateFiles(files);

            if (validFiles.length > 0) {
                onUpload(validFiles);
            }
        }
    };

    return (
        <div className="w-full">
            <motion.div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                tabIndex={0}
                role="button"
                aria-label="Upload documentation or images"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        document.getElementById('fileInput')?.click();
                    }
                }}
                animate={{
                    scale: isDragActive ? 1.01 : 1,
                }}
                className={[
                    'relative flex cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-6 transition-all duration-200 group sm:p-10',
                    'focus:outline-none focus:ring-2 focus:ring-app-focus',
                    isDragActive
                        ? 'border-app-brand-border-strong bg-app-brand-soft'
                        : 'border-app-border-muted bg-app-bg hover:border-app-brand-border hover:bg-app-surface-hover',
                    isUploading ? 'pointer-events-none opacity-50' : '',
                ].join(' ')}
                onClick={() => document.getElementById('fileInput')?.click()}
            >
                <input
                    id="fileInput"
                    type="file"
                    className="sr-only"
                    onChange={handleFileInput}
                    accept=".pdf,.md,.txt,.png,.jpg,.jpeg,.webp"
                    multiple
                />

                <div
                    className={[
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 sm:h-16 sm:w-16',
                        isDragActive
                            ? 'bg-app-brand text-white shadow-lg'
                            : 'bg-app-surface-muted text-app-text-muted group-hover:bg-app-brand-soft group-hover:text-app-brand-text',
                    ].join(' ')}
                >
                    {isUploading ? (
                        <Loader2 className="h-6 w-6 animate-spin sm:h-8 sm:w-8" />
                    ) : (
                        <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
                    )}
                </div>

                <div className="space-y-1 text-center">
                    <p className="text-base font-semibold text-app-text sm:text-lg">
                        {isUploading ? 'Processing artifacts...' : 'Drop multiple artifacts here'}
                    </p>

                    <p className="px-4 text-xs text-app-text-muted sm:text-sm">
                        {isUploading ? 'Ingesting your knowledge...' : 'Drag & drop Markdown or Images'}
                    </p>
                </div>

                <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-md border border-app-brand-border bg-app-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-app-brand-text">
                        <FileCode className="h-3 w-3" />
                        Docs (.md, .pdf)
                    </div>

                    <div className="flex items-center gap-1.5 rounded-md border border-app-neutral-border bg-app-neutral-bg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-app-neutral-text">
                        <ImageIcon className="h-3 w-3" />
                        Images (.png, .webp)
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-4 flex items-center gap-3 rounded-xl border border-app-danger-border bg-app-danger-bg p-4 text-sm text-app-danger-text"
                    >
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}