import { useCallback, useEffect, useState } from "react";
import { starterWorkService } from "../../../services/starterWorkService";
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

/**
 * Owns the PM's starter-work review queue: mining new proposals and deciding on each one.
 *
 * Mirrors `useGraphAuthoring` deliberately -- it is the same lifecycle, and a PM reviewing AI
 * output should not have to learn two different shapes. A decided task leaves local state
 * immediately rather than waiting on a refetch.
 */
export function useStarterWorkReview() {
  const [tasks, setTasks] = useState<StarterWorkTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateStarterWorkResult | null>(null);
  // A hand-authored task never joins the unreviewed queue below -- somebody already vouched
  // for it by writing it. This holds the just-created one so the page can confirm it, rather
  // than the PM wondering where it went.
  const [createdTask, setCreatedTask] = useState<StarterWorkTask | null>(null);
  // How it got there. Both land reviewed for the same reason, but "you wrote it" and "you picked
  // it out of the corpus" are different things to have just done, and the confirmation should
  // describe the one that happened.
  const [createdVia, setCreatedVia] = useState<TaskOrigin>("authored");

  const loadProposed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const proposed = await starterWorkService.fetchUnreviewed();
      setTasks(proposed.tasks);
    } catch (err) {
      setError(toMessage(err, "Could not load starter tasks."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadProposed();
    })();
  }, [loadProposed]);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const result = await starterWorkService.generate();
      setGenerateResult(result);
      await loadProposed();
    } catch (err) {
      setError(toMessage(err, "Could not mine starter tasks."));
    } finally {
      setIsGenerating(false);
    }
  }, [loadProposed]);

  const create = useCallback(async (input: CreateStarterWorkTaskInput): Promise<boolean> => {
    setError(null);
    try {
      const created = await starterWorkService.create(input);
      setCreatedTask(created);
      setCreatedVia("authored");
      return true;
    } catch (err) {
      setError(toMessage(err, "Could not create this task."));
      return false;
    }
  }, []);

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

  const dismissCreated = useCallback(() => setCreatedTask(null), []);

  const approve = useCallback(async (id: string) => {
    await starterWorkService.markReviewed(id);
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  const reject = useCallback(async (id: string, reason?: string) => {
    await starterWorkService.reject(id, reason);
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    tasks,
    isLoading,
    isGenerating,
    error,
    generateResult,
    createdTask,
    createdVia,
    generate,
    create,
    notePromoted,
    dismissCreated,
    approve,
    reject,
  };
}
