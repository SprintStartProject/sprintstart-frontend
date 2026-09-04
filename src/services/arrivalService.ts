import { apiClient } from "./apiClient";
import type {
  ArrivalStep,
  CreateArrivalStepRequest,
  DerivableArrivalStep,
  MyArrival,
  UpdateArrivalStepRequest,
} from "../features/arrival/types";

const BASE = "/api/v1/onboarding";

/** Company-wide is the absence of a project, on the wire as much as in the model. */
function scopeQuery(projectId?: string | null): string {
  return projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
}

export const arrivalService = {
  /**
   * The caller's own arrival steps, with what they have settled.
   *
   * Not project-scoped, unlike the board: an arrival step is a fact about a *person* — they have
   * a GitHub account, their machine builds — and it does not stop being true because they are
   * looking at a different project. The list is the union across every project they are on plus
   * the company-wide steps everybody gets.
   *
   * An empty list means nobody has authored any steps, which is a real answer rather than an
   * error.
   */
  async fetchMyArrival(): Promise<MyArrival> {
    return await apiClient.fetch<MyArrival>(`${BASE}/me/arrival`);
  },

  /**
   * Re-checks what the system can observe for the caller, and returns their steps as they stand.
   *
   * Split from the read, which touches nothing but the database. This is what actually
   * looks, and it runs once the card has already rendered.
   *
   * Observation settles a step; failing to observe never unsettles one. A GitHub outage, a
   * rate limit and a hire with no contributions yet are indistinguishable here and all mean the
   * same thing, so a failure needs no handling beyond leaving what was shown alone.
   */
  async refreshMyArrival(): Promise<MyArrival> {
    return await apiClient.fetch<MyArrival>(`${BASE}/me/arrival/refresh`, { method: "POST" });
  },

  /**
   * Records that the caller has done a step.
   *
   * Idempotent — confirming twice keeps the original settlement time, because the day something
   * happened does not move.
   *
   * @throws ApiError 400 when the step is one the system settles rather than the hire; 404 when
   * no step with that key applies to them.
   */
  async confirmStep(key: string): Promise<ArrivalStep> {
    return await apiClient.fetch<ArrivalStep>(
      `${BASE}/me/arrival/${encodeURIComponent(key)}/confirm`,
      { method: "POST" },
    );
  },

  /** Every authored step in a scope. Omit `projectId` for the company-wide list. */
  async listSteps(projectId?: string | null): Promise<ArrivalStep[]> {
    return await apiClient.fetch<ArrivalStep[]>(`${BASE}/arrival-steps${scopeQuery(projectId)}`);
  },

  /**
   * The steps the system can check for itself, and whether each is already on the list.
   *
   * Not project-scoped: a derivation is code, so the catalog is the same everywhere. `added`
   * reflects the company-wide list.
   */
  async listDerivableSteps(): Promise<DerivableArrivalStep[]> {
    return await apiClient.fetch<DerivableArrivalStep[]>(`${BASE}/arrival-steps/derivable`);
  },

  /** @throws ApiError 409 when a step with that key already exists in the same scope. */
  async createStep(request: CreateArrivalStepRequest): Promise<ArrivalStep> {
    return await apiClient.fetch<ArrivalStep>(`${BASE}/arrival-steps`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async updateStep(
    key: string,
    request: UpdateArrivalStepRequest,
    projectId?: string | null,
  ): Promise<ArrivalStep> {
    return await apiClient.fetch<ArrivalStep>(
      `${BASE}/arrival-steps/${encodeURIComponent(key)}${scopeQuery(projectId)}`,
      { method: "PATCH", body: JSON.stringify(request) },
    );
  },

  /**
   * Applies a whole ordering at once.
   *
   * The complete list, never a from/to pair, so two people reordering concurrently cannot
   * interleave into an order neither of them chose.
   */
  async reorderSteps(orderedKeys: string[], projectId?: string | null): Promise<ArrivalStep[]> {
    return await apiClient.fetch<ArrivalStep[]>(
      `${BASE}/arrival-steps/reorder${scopeQuery(projectId)}`,
      { method: "POST", body: JSON.stringify({ orderedKeys }) },
    );
  },

  /**
   * Deletes a step definition. Hires' records of having settled it survive — state is keyed by
   * the step key, so re-adding the same key restores them.
   */
  async deleteStep(key: string, projectId?: string | null): Promise<void> {
    await apiClient.fetch<void>(
      `${BASE}/arrival-steps/${encodeURIComponent(key)}${scopeQuery(projectId)}`,
      { method: "DELETE" },
    );
  },
};
