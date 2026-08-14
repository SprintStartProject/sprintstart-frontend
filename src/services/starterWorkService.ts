import { apiClient } from "./apiClient";
import type {
  CreateStarterWorkTaskInput,
  GenerateStarterWorkResult,
  PromoteStarterWorkCandidateInput,
  StarterWorkCandidate,
  StarterWorkTask,
  UnreviewedStarterWork,
} from "../features/starter-work/types";

const BASE_URL = "/api/v1/onboarding/starter-work";

/**
 * The PM's side of the starter-work pool.
 *
 * Nothing here gates a hire. Mined tasks are claimable the moment they land — S3b deleted
 * the approval gate — so reviewing one lifts the fit-ranking demotion it carries while nobody has
 * vouched for it, and removing one takes it out of the pool for good. The two are not opposites.
 *
 * This module's routes and prose said otherwise for a while: `/proposed`, `/approved`,
 * `/{id}/approve`, and comments about creating `CONTRIBUTION` nodes in a competency graph that S0
 * deleted. The behaviour was right the whole time; the names described the system it replaced.
 */
export const starterWorkService = {
  /** Mines the ingested corpus for well-scoped starter tasks. They are claimable on arrival. */
  async generate(): Promise<GenerateStarterWorkResult> {
    return await apiClient.fetch<GenerateStarterWorkResult>(`${BASE_URL}/generate`, {
      method: "POST",
    });
  },

  /** The live tasks nobody has vouched for yet — not a queue anything is waiting in. */
  async fetchUnreviewed(): Promise<UnreviewedStarterWork> {
    return await apiClient.fetch<UnreviewedStarterWork>(`${BASE_URL}/unreviewed`);
  },

  /** The whole live pool, reviewed or not — what a PM can author orientation for. */
  async fetchPool(): Promise<StarterWorkTask[]> {
    return await apiClient.fetch<StarterWorkTask[]>(`${BASE_URL}/pool`);
  },

  /**
   * Hand-authors a starter task, with no AI mining in the loop.
   *
   * It comes back already reviewed: a PM writing the task *is* the review, so it carries no
   * unvouched demotion and never appears in the unreviewed list.
   */
  async create(input: CreateStarterWorkTaskInput): Promise<StarterWorkTask> {
    return await apiClient.fetch<StarterWorkTask>(BASE_URL, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * The open issues a project's corpus already holds, for somebody picking starter work by hand.
   *
   * Not a queue and not a shortlist. Nothing here has been judged and nothing waits on a
   * decision — mining keeps filling the pool live regardless. Costs a query and no model call.
   *
   * Issues somebody else is assigned come back too, marked, as do issues already pooled or
   * removed: the filtering is this client's to do, and it can only filter honestly if it holds
   * what it is filtering.
   */
  async fetchCandidates(projectId: string): Promise<StarterWorkCandidate[]> {
    return await apiClient.fetch<StarterWorkCandidate[]>(
      `${BASE_URL}/candidates?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /**
   * Puts one browsed issue in the pool, live and reviewed.
   *
   * The same landing place as {@link create}: somebody looked at it, which is the whole content of
   * "reviewed". It adds a way in and gates nothing.
   *
   * Fails with 409 when the issue is already in the pool, was removed from it (rejection is
   * sticky), or is closed at its source.
   */
  async promoteCandidate(input: PromoteStarterWorkCandidateInput): Promise<StarterWorkTask> {
    return await apiClient.fetch<StarterWorkTask>(`${BASE_URL}/candidates/promote`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Records that somebody has looked at the task and is happy with it.
   *
   * This admits nothing — the task was claimable before and is claimable after. What changes
   * is that it stops being demoted for having nobody behind it. Idempotent.
   */
  async markReviewed(id: string): Promise<StarterWorkTask> {
    return await apiClient.fetch<StarterWorkTask>(`${BASE_URL}/${id}/review`, {
      method: "POST",
    });
  },

  /** Takes the task out of the pool for good. Sticky: mining never brings it back. */
  async reject(id: string, reason?: string): Promise<StarterWorkTask> {
    return await apiClient.fetch<StarterWorkTask>(`${BASE_URL}/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};
