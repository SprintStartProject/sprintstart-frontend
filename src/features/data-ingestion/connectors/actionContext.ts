import type { ActionContext } from "./types.ts";

/**
 * The selected project, for the actions that act on a project's link to a source
 * or on a project-owned connection.
 *
 * @throws Error naming what could not be done when no project is selected.
 */
export function requireProjectId(context: ActionContext, action: string): string {
  if (!context.projectId) {
    throw new Error(`Select a project before ${action}.`);
  }

  return context.projectId;
}
