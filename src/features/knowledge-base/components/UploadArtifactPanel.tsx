import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { FileUploadZone } from "./FileUploadZone";
import { knowledgeService } from "../../../services/knowledgeService";

interface UploadArtifactPanelProps {
  /** Project scope the uploaded files will be ingested into. */
  projectId: string;
  /** Fired as soon as a batch fully succeeds. */
  onUploadSuccess?: () => void;
  /**
   * Fired a moment after a fully-successful batch, so the host can dismiss
   * itself once the user has had time to read the result.
   */
  onFinished?: () => void;
  /** Reports upload progress so hosts can lock their own controls. */
  onUploadingChange?: (isUploading: boolean) => void;
}

/**
 * The upload flow itself — drop zone plus per-batch result — without any dialog
 * chrome. Kept separate from {@link UploadArtifactModal} so it can also be
 * rendered inline as a step of the Add-source wizard: embedding it there avoids
 * tearing down one modal to open another just to upload a file.
 */
export function UploadArtifactPanel({
  projectId,
  onUploadSuccess,
  onFinished,
  onUploadingChange,
}: UploadArtifactPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Holds the auto-finish timer so we can cancel it if the panel unmounts first.
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Submits the selected files to the backend for ingestion.
   * Parses the batch results to display per-file success/error states.
   */
  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    onUploadingChange?.(true);
    setBatchResult(null);

    try {
      const results = await knowledgeService.uploadDocuments(projectId, files);

      const successfulResults = results.filter((r) => r.status === "success");
      const failedResults = results.filter((r) => r.status === "error");

      setBatchResult({
        success: successfulResults.length,
        failed: failedResults.length,
        errors: failedResults.map((r) => `${r.filename}: ${r.error}`),
      });

      // Finish automatically after a fully-successful batch; stay open on errors
      // so the per-file reasons remain readable.
      if (failedResults.length === 0) {
        onUploadSuccess?.();
        finishTimerRef.current = setTimeout(() => {
          finishTimerRef.current = null;
          setBatchResult(null);
          onFinished?.();
        }, 2000);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      setBatchResult({
        success: 0,
        failed: files.length,
        errors: ["Upload failed due to a network or server error."],
      });
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
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
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              aria-live="polite"
              className={`mt-4 flex flex-col gap-2 rounded-xl border p-4 ${
                batchResult.failed > 0
                  ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
                  : "border-app-success-border bg-app-success-bg text-app-success-text"
              }`}
              data-testid="upload-batch-result"
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
                    <li key={`${i}-${err}`}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
