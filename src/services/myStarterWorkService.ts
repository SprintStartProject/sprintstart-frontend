import { apiClient } from "./apiClient";
import type { Goal, RankedStarterWorkTask } from "../features/starter-work/types";

const BASE_URL = "/api/v1/onboarding/starter-work/me";

/**
 * The hire's side of the starter-work pool: browsing it and grabbing a task from it.
 *
 * Kept apart from `starterWorkService`, which is the PM's side. Both endpoints existed before this
 * client did — the buddy's `claim_goal` action ends in the same `POST /me/goal` — so grabbing by
 * hand and grabbing through the buddy land in exactly the same place.
 */
export const myStarterWorkService = {
  /**
   * Every live task this hire may take on the project, best fit first, each with the reasons it
   * ranks where it does. Deterministic and local on the backend — no model call.
   */
  async fetchMatches(projectId: string): Promise<RankedStarterWorkTask[]> {
    return await apiClient.fetch<RankedStarterWorkTask[]>(
      `${BASE_URL}/matches?projectId=${encodeURIComponent(projectId)}`,
    );
  },

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
