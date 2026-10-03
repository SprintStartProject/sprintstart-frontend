import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../services/queryKeys";

/**
 * Marks the cached board stale after a write made outside the board itself — a checklist kept
 * from a reply, a card authored from a selection, a confirmed buddy action.
 *
 * These writes land on a surface the hire is usually not looking at, so nothing else would ever
 * re-read the board: an open board behind the dock keeps serving its previous read, and a visit
 * inside the `staleTime` window is served the pre-write copy. Marking is what makes whichever
 * comes next — the open board, or the next visit — show the card. Call it only once the write has
 * really happened: a failed save must not cost the board its cache.
 *
 * @param projectId - The project the card went to. Omit it only for writes whose project the
 *   backend resolved server-side (buddy actions) and never told the client — that marks every
 *   cached board rather than guessing one.
 * @returns A stable callback; call it after a successful write to invalidate the board cache.
 */
export function useInvalidateBoard(projectId?: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey:
        projectId === undefined ? queryKeys.board.all() : queryKeys.board.byProject(projectId),
    });
  }, [queryClient, projectId]);
}
