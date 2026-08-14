import { apiClient } from "./apiClient";
import type { Attestation } from "../features/attestation/types";

const BASE = "/api/v1/onboarding";

/**
 * Work a named colleague confirms — the evidence for roles nothing observes.
 *
 * Every call is caller-scoped by the backend: a hire can only request against themselves, and only
 * the person who was asked can answer. Nothing here passes a user id for that reason.
 */
export const attestationService = {
  /** Everything waiting on the caller to confirm, longest-waiting first. */
  async fetchPending(): Promise<Attestation[]> {
    return await apiClient.fetch<Attestation[]>(`${BASE}/attestations/pending`);
  },

  /** The caller's own requests on a project, oldest first. */
  async fetchMine(projectId: string): Promise<Attestation[]> {
    return await apiClient.fetch<Attestation[]>(
      `${BASE}/me/attestations?projectId=${encodeURIComponent(projectId)}`,
    );
  },

  /** Confirms the work happened and met the bar. */
  async accept(id: string): Promise<Attestation> {
    return await apiClient.fetch<Attestation>(
      `${BASE}/attestations/${encodeURIComponent(id)}/accept`,
      {
        method: "POST",
      },
    );
  },

  /**
   * Sends the work back with what needs to change.
   *
   * Counts as rework, exactly as a pull request sent back for changes does — which is why the
   * reason is required rather than optional.
   */
  async sendBack(id: string, reason: string): Promise<Attestation> {
    return await apiClient.fetch<Attestation>(
      `${BASE}/attestations/${encodeURIComponent(id)}/send-back`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
};
