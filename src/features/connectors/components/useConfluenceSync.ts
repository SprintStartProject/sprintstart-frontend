import { useState } from "react";
import { useToast } from "../../../context/useToast.ts";
import { parseApiError } from "../../../services/apiError.ts";
import {
  confluenceService,
  type ConfluenceIngestionResult,
} from "../../../services/sources/confluenceService.ts";

/**
 * Hook to trigger a manual sync for a Confluence space connection and surface
 * result toasts based on the ingestion status.
 *
 * The sync endpoint runs synchronously, so the toasts raised here are the final
 * word on the outcome. Failures are reported *and* rethrown: the caller still
 * needs to know that the run failed (to set its own error state), but it must
 * not report the failure a second time.
 */
export function useConfluenceSync(projectId?: string | null) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const toast = useToast();

  const syncConnection = async (
    connectionId: string,
    onSuccess?: (result: ConfluenceIngestionResult) => void,
  ): Promise<ConfluenceIngestionResult> => {
    if (!projectId) {
      const error = new Error("Project ID is required to sync Confluence spaces.");
      toast.error(error.message);
      throw error;
    }

    setSyncingId(connectionId);
    try {
      const result = await confluenceService.syncConnection(projectId, connectionId);

      if (result.status === "COMPLETED") {
        toast.success("Confluence sync completed", {
          description: `${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged.`,
        });
      } else if (result.status === "PARTIAL") {
        toast.warning("Confluence sync finished with errors", {
          description: `${result.failed} pages failed out of ${result.discovered} discovered.`,
        });
      } else {
        toast.error("Confluence sync failed", {
          description: "No pages could be ingested. Check connection permissions.",
        });
      }

      onSuccess?.(result);
      return result;
    } catch (error) {
      toast.error(parseApiError(error, "Failed to synchronize Confluence space."));
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
