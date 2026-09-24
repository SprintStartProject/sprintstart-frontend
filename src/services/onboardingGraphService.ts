import { apiClient } from "./apiClient";
import type { OnboardingStepEndpoint, StepType } from "../features/onboarding/types";

/** Where one node of an onboarding graph sits on the canvas. */
export type GraphNodePosition = { id: string; graphX: number; graphY: number };

export type ConnectedStepRequest = {
  step: {
    position: number;
    title: string;
    description: string;
    type: StepType;
    estimatedMinutes: number;
    expectedOutcome: string;
  };
  /** Items the new step opens after. */
  waitsOn: string[];
  /** Items that wait on the new step from now on. */
  unlocks: string[];
  graphX?: number;
  graphY?: number;
};

/**
 * Layout and edges of the two graphs of an onboarding path: its phases, and the steps and questions
 * inside each phase.
 *
 * Layout can be stored by the path's owner as well as by a PM -- it changes nothing about what is
 * open. Edges and connected steps are PM, HR and admin calls, because they decide what unlocks when.
 * Every call replaces a whole set: a batch of positions, or the complete blocker list of one node.
 */
export const onboardingGraphService = {
  // ── The hire's own path ─────────────────────────────────

  async arrangeMyPath(nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/path/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  async arrangeMyPhase(phaseId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/phases/${phaseId}/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  // ── Somebody else's path (PM, HR, admin) ─────────────────

  async arrangeUserPath(userId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/users/${userId}/path/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  async arrangePhase(phaseId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/phases/${phaseId}/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  async replaceNodeBlockers(nodeId: string, blockerIds: string[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/nodes/${nodeId}/blockers`, {
      method: "PUT",
      body: JSON.stringify({ blockerIds }),
    });
  },

  async replacePhaseBlockers(phaseId: string, blockerIds: string[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/phases/${phaseId}/blockers`, {
      method: "PUT",
      body: JSON.stringify({ blockerIds }),
    });
  },

  async createConnectedStep(
    phaseId: string,
    request: ConnectedStepRequest,
  ): Promise<OnboardingStepEndpoint> {
    return await apiClient.fetch<OnboardingStepEndpoint>(
      `/api/v1/onboarding/phases/${phaseId}/steps/connected`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    );
  },
};
