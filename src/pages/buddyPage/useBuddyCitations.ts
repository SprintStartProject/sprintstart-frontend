import { citationDrawerProjectId } from "../../features/buddy/citations/citationArtifact";
import { useCitationViewer } from "../../features/buddy/citations/useCitationViewer";
import type { BuddySession } from "./buddyPageTypes";

/**
 * The citation popover and the artifact drawer — one state pair per surface, rendered at the bottom
 * of the page. The handlers are stable, which is what the memoised thread compares.
 *
 * The drawer's content read is project-scoped: citations open in the conversation's own project,
 * not the globally selected one — the hire may have switched since it started.
 */
export function useBuddyCitations(session: BuddySession, selectedProjectId: string) {
  const viewer = useCitationViewer();
  const { sessions, currentSessionId, teamProjectId } = session;
  const current = sessions.find((entry) => entry.id === currentSessionId);
  const projectId = citationDrawerProjectId(current?.projectId, teamProjectId, selectedProjectId);

  return { viewer, projectId };
}
