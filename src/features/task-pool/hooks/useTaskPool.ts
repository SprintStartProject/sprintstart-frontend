import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { myStarterWorkService } from "../../../services/myStarterWorkService";
import { queryKeys } from "../../../services/queryKeys";
import type { Board, CurrentTaskContent } from "../../board/types";

/**
 * The pool, ranked for the signed-in hire. Only fetched while something is showing it: the browser
 * is opened on purpose, and a ranking read on every board visit would cost a query nobody looks at.
 */
export function useTaskPoolMatches(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.starterWork.myMatches(projectId),
    queryFn: () => myStarterWorkService.fetchMatches(projectId),
    enabled: enabled && Boolean(projectId),
  });
}

/**
 * The task the hire is on right now, read off the board already in the cache.
 *
 * Never fetches. Every place that grabs a task lives on the board, so the board has been read by
 * the time this is asked — and the current-task card is the one source the rest of the page
 * already agrees with. Null when there is no task, or no board loaded yet.
 */
export function useCurrentTask(projectId: string): CurrentTaskContent | null {
  const { data } = useQuery<Board>({
    queryKey: queryKeys.board.byProject(projectId),
    enabled: false,
  });
  const content = data?.cards.find((card) => card.content.kind === "CURRENT_TASK")?.content;
  return content?.kind === "CURRENT_TASK" && content.taskId !== null ? content : null;
}

/**
 * Grabs a pool task as the hire's current task.
 *
 * Re-reads the board and the ranking afterwards: the current-task card now says something else,
 * and the pool's "you're on this" marker has moved.
 */
export function useGrabTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => myStarterWorkService.claim(projectId, taskId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.board.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.starterWork.myMatches(projectId) }),
      ]),
  });
}
