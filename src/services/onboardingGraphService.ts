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

  /** Stores where the phases of the caller's own path sit on the journey map. */
  async arrangeMyPath(nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/path/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  /** Stores where the steps and questions of one phase of the caller's own path sit. */
  async arrangeMyPhase(phaseId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/me/phases/${phaseId}/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  // ── Somebody else's path (PM, HR, admin) ─────────────────

  /** Stores where the phases of another user's path sit on the journey map. */
  async arrangeUserPath(userId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/users/${userId}/path/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  /** Stores where the steps and questions of one phase of another user's path sit. */
  async arrangePhase(phaseId: string, nodes: GraphNodePosition[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/phases/${phaseId}/graph`, {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    });
  },

  /**
   * Replaces the complete list of items a step or question waits on inside its phase.
   */
  async replaceNodeBlockers(nodeId: string, blockerIds: string[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/nodes/${nodeId}/blockers`, {
      method: "PUT",
      body: JSON.stringify({ blockerIds }),
    });
  },

  /** Replaces the complete list of phases a phase waits on. */
  async replacePhaseBlockers(phaseId: string, blockerIds: string[]): Promise<void> {
    await apiClient.fetch(`/api/v1/onboarding/phases/${phaseId}/blockers`, {
      method: "PUT",
      body: JSON.stringify({ blockerIds }),
    });
  },

  /**
   * Adds a step to a phase and wires it into the phase graph in one call: it waits on the items
   * in `waitsOn`, and the items in `unlocks` wait on it from now on.
   *
   * @returns The created step.
   */
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
