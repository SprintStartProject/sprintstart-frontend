import { useEffect, useState } from "react";
import {
  knowledgeRequestService,
  onOpenEscalationsChanged,
} from "../../services/knowledgeRequestService";
import { useRateLimitedRead } from "../../hooks/useRateLimitedRead";

/**
 * How many escalated questions are still waiting on a person for this project.
 *
 * A count rather than the boolean dot `usePmAttentionFlag` shows, and that is a
 * deliberate departure from the reasoning there ("a count would have to stay
 * accurate to be trustworthy"). It is warranted here because the number is the
 * endpoint's own answer rather than something derived from a page-sized read —
 * but *only* if it keeps up with the page it points at, which is what the
 * subscription below is for: the PM who empties the queue is looking at this
 * badge while they do it, and a stale "5" beside a list of two is exactly the
 * untrustworthy count that reasoning warns about.
 *
 * Counted through its own endpoint, not `listOpen(...).length`. The full read
 * resolves every asker's name and onboarding position, and this is asked on
 * every navigation for every PM session.
 *
 * Returns 0 while disabled or with no project — so somebody who cannot open the
 * inbox never pays for the request nor sees the badge — and 0 when the read
 * fails, since a badge is not worth surfacing an error for.
 *
 * @param refreshKey Changing this asks for a recheck; callers pass the current
 * route, so returning to the sidebar from elsewhere refreshes it.
 */
export function useOpenEscalationCount(
  projectId: string | null | undefined,
  enabled: boolean,
  refreshKey?: string,
): number {
  // Bumped when the queue demonstrably changed under the PM's own hands, so the
  // recheck is immediate rather than waiting for a navigation that may never
  // come — they can answer every question without leaving the inbox.
  const [changeNonce, setChangeNonce] = useState(0);

  useEffect(
    () =>
      onOpenEscalationsChanged(() => {
        setChangeNonce((current) => current + 1);
      }),
    [],
  );

  return useRateLimitedRead(() => knowledgeRequestService.countOpen(projectId as string), 0, {
    key: projectId,
    enabled,
    refreshKey,
    nonce: changeNonce,
  });
}
