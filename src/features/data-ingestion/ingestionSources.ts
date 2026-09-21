import { createSourceFromInstance } from "./data.ts";
import { getIngestionSourceStatuses } from "../../services/ingestionService.ts";

/**
 * One row per connected repository, scoped to the selected project — the same
 * granularity the Data Ingestion page shows. The per-source-system aggregate
 * used previously collapsed every GitHub repo into a single row, so a project
 * with three connected repos reported "1/1 synced".
 */
export async function fetchIngestionSources(projectId: string) {
  const instances = await getIngestionSourceStatuses(projectId);

  return instances.map(createSourceFromInstance);
}
