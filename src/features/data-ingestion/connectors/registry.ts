import type { ProjectSource } from "../../../services/projectService.ts";
import type { ConfluenceConnectionDto } from "../../../services/sources/confluenceService.ts";
import type { JiraInstanceDto } from "../../../services/sources/jiraService.ts";
import { confluenceConnector } from "./confluence/definition.ts";
import { githubConnector } from "./github/definition.ts";
import { jiraConnector } from "./jira/definition.ts";
import { SOURCE_SYSTEMS, type SourceSystem } from "./sourceSystems.ts";
import type { ConnectorDefinition } from "./types.ts";
import { uploadConnector } from "./upload/definition.ts";

/** The connection record each connector's cards are merged with. */
type ConnectionOf = {
  GITHUB: ProjectSource;
  JIRA: JiraInstanceDto;
  UPLOAD: ProjectSource;
  CONFLUENCE: ConfluenceConnectionDto;
};

/**
 * Every connector the data ingestion UI knows. A new connector is one folder
 * with a definition plus one entry here; the record type makes a missing entry a
 * compile error.
 */
export const CONNECTORS: { [S in SourceSystem]: ConnectorDefinition<ConnectionOf[S]> } = {
  GITHUB: githubConnector,
  JIRA: jiraConnector,
  UPLOAD: uploadConnector,
  CONFLUENCE: confluenceConnector,
};

/** The definitions in the order the source systems are offered. */
export const CONNECTOR_LIST: ConnectorDefinition[] = SOURCE_SYSTEMS.map(
  (system) => CONNECTORS[system],
);

/** The definition of a source system, without knowing its connection record. */
export function getConnector(system: SourceSystem): ConnectorDefinition {
  return CONNECTORS[system];
}

/** The definition behind a backend connector id (lowercase, e.g. "github"), if there is one. */
export function findConnectorById(connectorId: string): ConnectorDefinition | null {
  return CONNECTOR_LIST.find((definition) => definition.meta.connectorId === connectorId) ?? null;
}

/** The source systems the chat's source filter offers. */
export const CHAT_SOURCE_SYSTEMS: readonly SourceSystem[] = CONNECTOR_LIST.filter(
  (definition) => definition.chat.filterable,
).map((definition) => definition.meta.system);

/** The source systems whose sources can be put on a sync schedule. */
export const SCHEDULED_SOURCE_SYSTEMS: readonly SourceSystem[] = CONNECTOR_LIST.filter(
  (definition) => definition.supportsSchedule,
).map((definition) => definition.meta.system);
