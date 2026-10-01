import { useState } from "react";
import { useToast } from "../../../context/useToast.ts";
import { parseApiError } from "../../../services/apiError.ts";
import { notionService, type NotionSyncResult } from "../../../services/sources/notionService.ts";

/**
 * Hook to trigger a manual sync for a Notion page connection and surface a toast
 * per outcome.
 *
 * The sync endpoint runs synchronously, so the toasts raised here are the final
 * word on the outcome. A `FAILED` outcome is a normal response (the run exists
 * and was recorded), so it is reported and returned rather than thrown; a
 * request that fails outright is reported *and* rethrown, so the caller knows
 * the sync did not happen without reporting it a second time.
 */
export function useNotionSync(projectId?: string | null) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const toast = useToast();

  const syncConnection = async (
    connectionId: string,
    onSuccess?: (result: NotionSyncResult) => void,
  ): Promise<NotionSyncResult> => {
    if (!projectId) {
      const error = new Error("Project ID is required to sync Notion pages.");
      toast.error(error.message);
      throw error;
    }

    setSyncingId(connectionId);
    try {
      const result = await notionService.syncConnection(projectId, connectionId);

      if (result.outcome === "CREATED") {
        toast.success("Notion page ingested", {
          description: "The page was added to the knowledge base.",
        });
      } else if (result.outcome === "UPDATED") {
        toast.success("Notion page updated", {
          description: "The page changed in Notion and was ingested again.",
        });
      } else if (result.outcome === "UNCHANGED") {
        toast.info("Notion page is up to date", {
          description: "Nothing changed in Notion since the last sync.",
        });
      } else {
        toast.error("Notion sync failed", {
          description: result.failure?.message
            ? `${result.failure.message} (${result.failure.stage})`
            : "The page could not be ingested. Check that it is still shared with the integration.",
        });
      }

      // A failed run is still a run: refresh so it shows up in the history.
      onSuccess?.(result);
      return result;
    } catch (error) {
      toast.error(parseApiError(error, "Failed to synchronize Notion page."));
      throw error;
    } finally {
      setSyncingId(null);
    }
  };

  return {
    syncConnection,
    syncingId,
  };
}
