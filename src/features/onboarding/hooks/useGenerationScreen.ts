import { useState } from "react";
import type {
  GenerationPhaseProgress,
  OnboardingJourneyValue,
} from "../generation/OnboardingJourneyContext";

type Snapshot = {
  phases: GenerationPhaseProgress[];
  startedAt: number;
  completed: boolean;
};

function snapshotOf(generation: OnboardingJourneyValue["generation"]): Snapshot {
  return generation.status === "running"
    ? { phases: generation.phases, startedAt: generation.startedAt, completed: false }
    : { phases: [], startedAt: 0, completed: false };
}

/**
 * What the generation screen shows, and for how long.
 *
 * The last running generation is kept so the screen can stay up while the dino game is still being
 * played after the run has ended (`isDinoActive`). `completed` outlives the `done` status on
 * purpose: the page clears a finished generation as soon as the new path is fetched, so the status
 * drops to `idle` while the game may still be open. Without the flag the screen would fall back to
 * the frozen "working" snapshot and stop saying "Path ready".
 *
 * Follows the generation during render (React's "adjust state when a value changes" pattern)
 * rather than in an effect, so the screen never paints one frame with a stale outcome.
 */
export function useGenerationScreen(generation: OnboardingJourneyValue["generation"]) {
  const [isDinoActive, setIsDinoActive] = useState(false);
  const [lastGeneration, setLastGeneration] = useState<Snapshot>(() => snapshotOf(generation));
  const [seenGeneration, setSeenGeneration] = useState(generation);

  if (seenGeneration !== generation) {
    setSeenGeneration(generation);
    if (generation.status === "running") {
      setLastGeneration(snapshotOf(generation));
    } else if (generation.status === "done") {
      setLastGeneration((previous) => ({ ...previous, completed: true }));
    } else if (generation.status === "error") {
      // Failure wins over the game: the snapshot's phases are still "working", so keeping the
      // generation screen up for the game would hide the failure behind a wait that is over.
      // Dropping the flag unmounts the screen, which releases the game's shared slot with it.
      setIsDinoActive(false);
    }
  }

  return { lastGeneration, isDinoActive, setIsDinoActive };
}
