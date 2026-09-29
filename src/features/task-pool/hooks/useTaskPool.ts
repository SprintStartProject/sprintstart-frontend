import { useMutation, useQuery } from "@tanstack/react-query";
import { myStarterWorkService } from "../../../services/myStarterWorkService";
import { queryKeys } from "../../../services/queryKeys";
import { useInvalidateBoard } from "../../board/hooks/useInvalidateBoard";
import type { Board, CurrentTaskContent } from "../../board/types";

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
 * Re-reads this project's board afterwards, whatever happened. On success the current-task card
 * says something else (or has just been pinned) and the pool's "you're on this" marker has moved.
 * On a 409 the backend has just checked the task against its source and found it no longer live —
 * so the pool card is known to be stale, and the task should leave it under the toast that says so.
 */
export function useGrabTask(projectId: string) {
  const invalidateBoard = useInvalidateBoard(projectId);
  return useMutation({
    mutationFn: (taskId: string) => myStarterWorkService.claim(projectId, taskId),
    onSettled: invalidateBoard,
  });
}
