import { useEffect, useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "../../../../components/ui/Button.tsx";
import { FileUploadZone } from "../../../knowledge-base/components/FileUploadZone.tsx";
import type { DraftFormProps } from "../types.ts";
import { createUploadDraft, type UploadDraftSource } from "./draft.ts";

/**
 * Add-source form for uploads: the files are staged in memory and uploaded once
 * the project exists. Reports one draft holding all staged files.
 */
export function UploadDraftForm({ onDraftsChange }: DraftFormProps<UploadDraftSource>) {
  const [files, setFiles] = useState<File[]>([]);

  const drafts = useMemo(
    () =>
      files.length > 0
        ? [createUploadDraft(files.length === 1 ? files[0].name : "Uploaded documents", files)]
        : [],
    [files],
  );

  useEffect(() => {
    onDraftsChange(drafts);
  }, [drafts, onDraftsChange]);

  return (
    <div className="space-y-4">
      <FileUploadZone
        onUpload={(added) => setFiles((current) => [...current, ...added])}
        isUploading={false}
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
              <span className="max-w-[16rem] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() =>
                  setFiles((current) => current.filter((_, position) => position !== index))
                }
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
