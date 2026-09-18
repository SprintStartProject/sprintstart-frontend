import { createContext, useContext } from "react";
import type { OnboardingPathEndpoint } from "../types";

/** How far one phase of a running generation has come, as the backend's stage events report it. */
export type GenerationPhaseProgress = {
  name: string;
  detail: string;
  state: "waiting" | "working" | "done" | "failed";
};

export type OnboardingGeneration =
  | { status: "idle" }
  | {
      status: "running";
      projectId: string;
      startedAt: number;
      phases: GenerationPhaseProgress[];
    }
  | { status: "done"; path: OnboardingPathEndpoint | null }
  | { status: "error"; message: string; reason?: GenerationFailureReason };

/**
 * Why a generation ended without a path, when the backend could say:
 *
 * - `not-enough-knowledge`: the AI ran, but the project's knowledge covers no phase yet -- often
 *   because material that was just added is still being processed.
 * - `ai-unavailable`: the AI service could not assemble anything; trying again later can help.
 * - `no-phases`: the blueprint has no phase for this hire's role and skills.
 */
export type GenerationFailureReason = "not-enough-knowledge" | "ai-unavailable" | "no-phases";

const FAILURE_REASONS: readonly GenerationFailureReason[] = [
  "not-enough-knowledge",
  "ai-unavailable",
  "no-phases",
];

export function asFailureReason(value: string | undefined): GenerationFailureReason | undefined {
  return FAILURE_REASONS.find((reason) => reason === value);
}

/**
 * Whether the onboarding entry belongs in the navigation.
 *
 * - `loading`: not known yet.
 * - `path`: the user has a path.
 * - `buildable`: no path yet, but one can be built from the selected project.
 * - `unavailable`: no path, and nothing to build one from -- see {@link UnavailableReason}.
 */
export type OnboardingAvailability = "loading" | "path" | "buildable" | "unavailable";

export type UnavailableReason = "no-project" | "no-blueprint" | "no-content";

export type OnboardingJourneyValue = {
  generation: OnboardingGeneration;
  /** Starts building a path from the project, or watches the generation already running. */
  startGeneration: (projectId: string) => void;
  /** Forgets a finished or failed generation, e.g. once the page has shown its result. */
  clearGeneration: () => void;
  availability: OnboardingAvailability;
  unavailableReason: UnavailableReason | null;
  /** Asks again, e.g. after a path was deleted. */
  refreshAvailability: () => void;
};

export const OnboardingJourneyContext = createContext<OnboardingJourneyValue | null>(null);

const OUTSIDE_PROVIDER: OnboardingJourneyValue = {
  generation: { status: "idle" },
  startGeneration: () => {},
  clearGeneration: () => {},
  availability: "path",
  unavailableReason: null,
  refreshAvailability: () => {},
};

/**
 * The onboarding journey as the whole app sees it: a generation that keeps running while the user
 * is on other pages, and whether there is any onboarding to show at all.
 *
 * Outside the provider -- a component rendered alone in a test -- it reports a path that exists and
 * nothing generating, so pages behave as they did before the provider existed.
 */
export function useOnboardingJourney(): OnboardingJourneyValue {
  return useContext(OnboardingJourneyContext) ?? OUTSIDE_PROVIDER;
}
