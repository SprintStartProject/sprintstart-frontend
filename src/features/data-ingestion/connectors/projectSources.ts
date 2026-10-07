import { projectService, type ProjectSource } from "../../../services/projectService.ts";
import type { ConnectionSupport } from "./types.ts";

/**
 * How GitHub repositories and uploads are loaded: both are project sources, read
 * from the project-scoped detail endpoint any member may reach (not from the
 * admin-only project listing behind the switcher, which leaves `sources` empty for
 * PM and member users). The two share one scope, so they cost one request.
 *
 * The list holds every kind of source the project has; the card builder picks the
 * ones it needs by type.
 */
export const projectSourceConnections: ConnectionSupport<ProjectSource> = {
  scope: "project-sources",
  failureMessage: "Project sources could not be loaded.",
  async load(projectId) {
    return (await projectService.getAccessibleProject(projectId)).sources;
  },
};
