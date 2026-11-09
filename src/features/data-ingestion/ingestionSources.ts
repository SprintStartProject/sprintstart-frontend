import { createDataSourceFromStatus } from "./data.ts";
import { getIngestionSourceStatuses } from "../../services/ingestionService.ts";

/**
 * One row per connected repository, scoped to the selected project — the same granularity the Data
 * Ingestion page shows; a per-source-system aggregate would collapse every GitHub repo into a
 * single row. Each row is mapped by its own source system, so Jira, Confluence and upload sources
 * carry their own identity.
 */
export async function fetchIngestionSources(projectId: string) {
  const instances = await getIngestionSourceStatuses(projectId);

  return instances.map(createDataSourceFromStatus);
}
