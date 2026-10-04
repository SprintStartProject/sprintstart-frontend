import { useCallback } from "react";
import { useToast } from "../../../context/useToast.ts";
import { parseApiError } from "../../../services/apiError.ts";
import { getConnector } from "../connectors/registry.ts";
import type { DataSource } from "../types.ts";

/**
 * Runs a source's synchronous sync (the connector's `manualSync` action) and
 * reports how it went with a toast, the same way for every connector.
 *
 * The sync runs to completion, so the toast raised here is the final word on the
 * outcome. Failures are reported *and* rethrown: the caller still needs to know
 * that the sync failed (to set its own error state), but it must not report the
 * failure a second time.
 *
 * @param projectId - The selected project, which project-owned connections are synced through.
 */
export function useManualSync(projectId: string | null) {
  const toast = useToast();

  return useCallback(
    async (source: DataSource): Promise<void> => {
      const definition = getConnector(source.sourceSystem);
      const manualSync = definition.actions.manualSync;
      if (!manualSync) throw new Error("This source cannot be synchronized manually.");

      try {
        const outcome = await manualSync.run(source, { projectId });

        if (outcome.status === "COMPLETED") {
          toast.success(outcome.title, { description: outcome.description });
        } else if (outcome.status === "PARTIAL") {
          toast.warning(outcome.title, { description: outcome.description });
        } else {
          toast.error(outcome.title, { description: outcome.description });
        }
      } catch (error) {
        const { label, noun } = definition.meta;
        toast.error(parseApiError(error, `Failed to synchronize ${label} ${noun.singular}.`));
        throw error;
      }
    },
    [projectId, toast],
  );
}
