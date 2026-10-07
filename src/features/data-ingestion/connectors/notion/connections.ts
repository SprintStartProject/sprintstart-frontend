import {
  notionService,
  type NotionWorkspaceConnectionDto,
} from "../../../../services/sources/notionService.ts";
import type { ConnectionSupport } from "../types.ts";

/**
 * Where the page loads a project's Notion workspace connections from. The add-source
 * form reads the same list under the same scope, so it shares the page's request.
 */
export const notionConnections: ConnectionSupport<NotionWorkspaceConnectionDto> = {
  scope: "notion",
  // A manual or scheduled sync stamps the connection, so it follows the status rows while runs go.
  live: true,
  load: (projectId) => notionService.listConnections(projectId),
};
