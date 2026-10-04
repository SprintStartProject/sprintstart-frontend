import { knowledgeService } from "../../../../services/knowledgeService.ts";
import {
  NOTHING_EXTRA,
  newDraftBase,
  type DraftConnectOutcome,
  type DraftSourceBase,
} from "../draft.ts";

export type UploadDraftSource = DraftSourceBase & {
  type: "UPLOAD";
  displayName: string;
  /** Selected files, held in memory until provisioning uploads them. */
  files: File[];
};

export function createUploadDraft(displayName: string, files: File[]): UploadDraftSource {
  return {
    ...newDraftBase(),
    type: "UPLOAD",
    displayName,
    files,
  };
}

/** Uploads the staged files into the project. */
export async function connectUploadDraft(
  source: UploadDraftSource,
  projectId: string,
): Promise<DraftConnectOutcome> {
  // Files are uploaded now that the project exists. uploadDocuments settles
  // every file itself and never throws, so a per-file error surfaces as a
  // `status: "error"` entry rather than a rejection — turn any into a failure
  // for this row so the batch loop records and can retry it.
  const results = await knowledgeService.uploadDocuments(projectId, source.files);
  const failed = results.filter((result) => result.status === "error");

  if (failed.length > 0) {
    const detail = failed[0]?.error;
    throw new Error(
      failed.length === source.files.length
        ? detail || "The files could not be uploaded."
        : `${failed.length} of ${source.files.length} files could not be uploaded.`,
    );
  }

  return NOTHING_EXTRA;
}
