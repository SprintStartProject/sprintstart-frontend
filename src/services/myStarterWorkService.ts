import { apiClient } from "./apiClient";
import type { Goal } from "../features/starter-work/types";

const BASE_URL = "/api/v1/onboarding/starter-work/me";

/**
 * The hire's side of the starter-work pool: grabbing a task from it. Browsing needs no call of its
 * own — the board's `TASK_POOL` card carries the ranked pool.
 *
 * Kept apart from `starterWorkService`, which is the PM's side. The buddy's `claim_goal` action ends
 * in the same `POST /me/goal`, so grabbing by hand and grabbing through the buddy land in exactly
 * the same place — including the current-task card being pinned to the board.
 */
export const myStarterWorkService = {
  /**
   * Makes a pool task the hire's current task, replacing whatever they were on.
   *
   * Fails with 409 when the task closed at its source since the pool last looked — the backend
   * checks the tracker at this moment rather than trusting the pool's last pass.
   */
  async claim(projectId: string, taskId: string): Promise<Goal> {
    return await apiClient.fetch<Goal>(
      `${BASE_URL}/goal?projectId=${encodeURIComponent(projectId)}`,
      { method: "POST", body: JSON.stringify({ taskId }) },
    );
  },
};
