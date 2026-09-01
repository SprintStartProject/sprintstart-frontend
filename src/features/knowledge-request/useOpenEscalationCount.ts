import { knowledgeRequestService } from "../../services/knowledgeRequestService";
import { useRateLimitedRead } from "../../hooks/useRateLimitedRead";

/**
 * How many escalated questions are still waiting on a person for this project.
 *
 * A count rather than the boolean dot `usePmAttentionFlag` shows, and that is a
 * deliberate departure from the reasoning there ("a count would have to stay
 * accurate to be trustworthy"). It is warranted here because the number *is*
 * the endpoint's answer: `listOpen` returns exactly the rows the inbox will
 * render, so the badge cannot disagree with the page it points at. The PM
 * marker counts two signals folded out of a page-sized read, which is a very
 * different thing to promise a number about.
 *
 * Returns 0 while disabled or with no project — so somebody who cannot open the
 * inbox never pays for the request nor sees the badge — and 0 when the read
 * fails, since a badge is not worth surfacing an error for.
 *
 * @param refreshKey Changing this asks for a recheck; callers pass the current
 * route, so answering or dismissing and navigating back shows the new number.
 */
export function useOpenEscalationCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  return useRateLimitedRead(
    async () => {
      const open = await knowledgeRequestService.listOpen(projectId as string);
      return open.length;
    },
    0,
    { key: projectId, enabled, refreshKey },
  );
}
