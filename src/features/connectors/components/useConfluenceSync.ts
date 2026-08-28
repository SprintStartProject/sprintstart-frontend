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
 */
export function useConfluenceSync(projectId?: string | null) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const toast = useToast();

  const syncConnection = async (
    connectionId: string,
    onSuccess?: (result: ConfluenceIngestionResult) => void,
  ) => {
    if (!projectId) {
      toast.error("Project ID is required to sync Confluence spaces.");
      return;
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
    } catch (error) {
      toast.error(parseApiError(error, "Failed to synchronize Confluence space."));
    } finally {
      setSyncingId(null);
    }
  };

  return {
    syncConnection,
    syncingId,
  };
}
