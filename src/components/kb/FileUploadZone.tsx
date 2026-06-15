import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileCode, Loader2, AlertCircle, ImageIcon } from 'lucide-react';

interface Props {
    onUpload: (files: File[]) => void;
    isUploading: boolean;
}

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
            'image/webp'
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB
        const validFiles: File[] = [];
        let hasError = false;

        Array.from(files).forEach(file => {
            const isMd = file.name.toLowerCase().endsWith('.md');
            if (!allowedTypes.includes(file.type) && !isMd) {
                setError(`File type not supported: ${file.name}. Only PDF, MD, TXT, PNG, JPG, and WEBP are allowed.`);
                hasError = true;
            } else if (file.size > maxSize) {
                setError(`File too large: ${file.name}. Max size is 10MB.`);
                hasError = true;
            } else {
                validFiles.push(file);
            }
        });

        if (!hasError) setError(null);
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
                animate={{
                    borderColor: isDragActive ? '#2563eb' : '#1e293b',
                    backgroundColor: isDragActive ? 'rgba(37, 99, 235, 0.05)' : 'rgba(15, 23, 42, 0.5)',
                    scale: isDragActive ? 1.01 : 1
                }}
                className={`
                    relative border-2 border-dashed rounded-2xl p-6 sm:p-10 
                    flex flex-col items-center justify-center gap-5
                    transition-all duration-200 cursor-pointer group
                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
                onClick={() => document.getElementById('fileInput')?.click()}
            >
                <input
                    id="fileInput"
                    type="file"
                    className="hidden"
                    onChange={handleFileInput}
                    accept=".pdf,.md,.txt,.png,.jpg,.jpeg,.webp"
                    multiple
                />

                <div className={`
                    w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center
                    ${isDragActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-800 text-slate-400 group-hover:text-blue-400 group-hover:bg-slate-700'}
                    transition-all duration-300
                `}>
                    {isUploading ? (
                        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
                    ) : (
                        <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                    )}
                </div>

                <div className="text-center space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-white">
                        {isUploading ? 'Processing artifacts...' : 'Drop multiple artifacts here'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 px-4">
                        {isUploading ? 'Ingesting your knowledge...' : 'Drag & drop Markdown or Images'}
                    </p>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600/10 border border-blue-600/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                        <FileCode className="w-3 h-3" />
                        Docs (.md, .pdf)
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600/10 border border-indigo-600/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                        <ImageIcon className="w-3 h-3" />
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
                        className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-center gap-3"
                    >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
