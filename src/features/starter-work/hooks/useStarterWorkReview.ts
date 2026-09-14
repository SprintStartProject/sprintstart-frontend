import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { starterWorkService } from "../../../services/starterWorkService";
import { queryKeys } from "../../../services/queryKeys";
import type {
  CreateStarterWorkTaskInput,
  GenerateStarterWorkResult,
  StarterWorkTask,
} from "../types";

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** How a task reached the pool without being mined: written from scratch, or picked from the corpus. */
export type TaskOrigin = "authored" | "picked";

type ReviewAction = { kind: "generate" } | { kind: "create"; input: CreateStarterWorkTaskInput };

const NO_TASKS: StarterWorkTask[] = [];

/**
 * Owns the PM's starter-work review queue: mining new proposals and deciding on each one.
 *
 * Mirrors `useGraphAuthoring` deliberately -- it is the same lifecycle, and a PM reviewing AI
 * output should not have to learn two different shapes. A decided task leaves the cache
 * immediately rather than waiting on a refetch.
 *
 * `generate` and `create` share one mutation (and one `error` slot) because both are "soft"
 * failures the caller reports as a toast rather than reacting to; `approve` and `reject` stay
 * plain functions that re-throw, because their callers (`StarterWorkPage`) need the rejection
 * to settle a card or keep a drawer open.
 */
export function useStarterWorkReview() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.starterWork.review();

  const {
    data,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => starterWorkService.fetchUnreviewed().then((proposed) => proposed.tasks),
  });

  // A hand-authored task never joins the unreviewed queue below -- somebody already vouched
  // for it by writing it. This holds the just-created one so the page can confirm it, rather
  // than the PM wondering where it went.
  const [createdTask, setCreatedTask] = useState<StarterWorkTask | null>(null);
  // How it got there. Both land reviewed for the same reason, but "you wrote it" and "you picked
  // it out of the corpus" are different things to have just done, and the confirmation should
  // describe the one that happened.
  const [createdVia, setCreatedVia] = useState<TaskOrigin>("authored");
  const [generateResult, setGenerateResult] = useState<GenerateStarterWorkResult | null>(null);

  const actionMutation = useMutation({
    mutationFn: async (action: ReviewAction) => {
      if (action.kind === "generate") {
        return { kind: "generate" as const, result: await starterWorkService.generate() };
      }
      return { kind: "create" as const, task: await starterWorkService.create(action.input) };
    },
    onSuccess: async (result) => {
      if (result.kind === "generate") {
        setGenerateResult(result.result);
        await refetch();
      } else {
        setCreatedTask(result.task);
        setCreatedVia("authored");
      }
    },
  });

  const generate = useCallback(async () => {
    try {
      await actionMutation.mutateAsync({ kind: "generate" });
    } catch {
      // Surfaced below via `error`; callers don't need the rejection.
    }
  }, [actionMutation]);

  const create = useCallback(
    async (input: CreateStarterWorkTaskInput): Promise<boolean> => {
      try {
        await actionMutation.mutateAsync({ kind: "create", input });
        return true;
      } catch {
        return false;
      }
    },
    [actionMutation],
  );

  /**
   * Confirms a task the issue browser just put in the pool.
   *
   * The browser owns the promotion itself, because it owns the list the promoted row lives in.
   * This is only the confirmation, so a picked task lands in the same place on screen as a
   * written one — it never appears in the queue below either, for the same reason.
   */
  const notePromoted = useCallback((task: StarterWorkTask) => {
    setCreatedTask(task);
    setCreatedVia("picked");
  }, []);

  const approve = useCallback(
    async (id: string) => {
      await starterWorkService.markReviewed(id);
      queryClient.setQueryData(queryKey, (prev: StarterWorkTask[] | undefined) =>
        prev?.filter((task) => task.id !== id),
      );
    },
    [queryClient, queryKey],
  );

  const reject = useCallback(
    async (id: string, reason?: string) => {
      await starterWorkService.reject(id, reason);
      queryClient.setQueryData(queryKey, (prev: StarterWorkTask[] | undefined) =>
        prev?.filter((task) => task.id !== id),
      );
    },
    [queryClient, queryKey],
  );

  const error = actionMutation.isError
    ? toMessage(
        actionMutation.error,
        actionMutation.variables?.kind === "generate"
          ? "Could not mine starter tasks."
          : "Could not create this task.",
      )
    : isError
      ? toMessage(loadError, "Could not load starter tasks.")
      : null;

  return {
    tasks: data ?? NO_TASKS,
    isLoading,
    isGenerating: actionMutation.isPending && actionMutation.variables?.kind === "generate",
    error,
    generateResult,
    createdTask,
    createdVia,
    generate,
    create,
    notePromoted,
    approve,
    reject,
  };
}
