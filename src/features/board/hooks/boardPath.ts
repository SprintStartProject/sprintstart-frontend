import { createContext, useContext } from "react";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import type { PathPhases } from "../layout/pathStages";

/**
 * The hire's path, for the cards on the board that link into it with `[[…]]`.
 *
 * The board page already reads the path once (for Now and Behind you); the notes are many, and each one
 * fetching it again to draw a chip or offer a step to link would be one request per card. So the
 * page hands it down. Outside the board — a card drawn in a test, say — there is none, and the links
 * are drawn as plain titles.
 */
export type BoardPath = {
  path: OnboardingPathEndpoint | null;
  phases: PathPhases | null;
  /** Whether the path has been read at least once — see `useOnboardingPath`. */
  settled?: boolean;
};

export const BoardPathContext = createContext<BoardPath>({ path: null, phases: null });

export function useBoardPath(): BoardPath {
  return useContext(BoardPathContext);
}
