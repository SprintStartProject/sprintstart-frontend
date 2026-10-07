import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** The search parameter that holds the member shown in the PM area's side panel. */
export const MEMBER_PEEK_PARAM = "member";

/**
 * Opens and closes the member side panel through the URL.
 *
 * A search parameter rather than component state, for three reasons: the panel survives a
 * reload and can be linked to, the browser's Back closes it the way Back closes anything that
 * was opened, and every PM page gets the same panel without any of them owning it — whatever
 * page is on screen, `?member=<id>` shows that member over it.
 */
export function useMemberPeek() {
  const [params, setParams] = useSearchParams();
  const memberId = params.get(MEMBER_PEEK_PARAM);

  const openMember = useCallback(
    (userId: string) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set(MEMBER_PEEK_PARAM, userId);
        return next;
      });
    },
    [setParams],
  );

  // Replaces rather than pushes: closing is not a place worth coming back to, and a pushed
  // close would make Back re-open the panel that was just dismissed.
  const closeMember = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(MEMBER_PEEK_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { memberId, openMember, closeMember };
}
