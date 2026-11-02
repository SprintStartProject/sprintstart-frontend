import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { pathPhases, pathStages } from "../layout/pathStages";
import { readCardOrigins, type CardOrigins } from "../layout/cardOrigins";
import { useOnboardingPath } from "./useOnboardingPath";
import { useStoredFor } from "./useStoredFor";

/**
 * Where the board stands against the onboarding path: the path, what stage each card is in, where
 * each card was found, and the phase the board was opened for.
 *
 * Nothing here sets a stage: the path is the one plan, and the board files its cards against it.
 *
 * @param projectId - The project the origins were written under.
 * @param storageRevision - Bumped when the stored arrangement is replaced underneath the page.
 */
export function useBoardPath(projectId: string, storageRevision: number) {
  /**
   * Where each card was found -- see `cardOrigins.ts`.
   *
   * Read once when the board arrives and never written here: the origin is recorded by whoever made
   * the card, which is always somewhere else in the app. Keyed by project *and* revision, because
   * the surfaces that write one -- the selection toolbar, a chat, the buddy dock -- know the project
   * and not the board, and a card saved from the dock while this page is open writes them without
   * leaving it. Read under `selectedProjectId`, the id those surfaces write under, and not under the
   * board's own `projectId`.
   */
  const [cardOrigins] = useStoredFor<CardOrigins>(
    `${projectId}:${storageRevision}`,
    () => readCardOrigins(projectId),
    {},
  );

  const { path, settled: pathSettled } = useOnboardingPath();
  const phases = useMemo(() => (path ? pathPhases(path) : null), [path]);
  const stageOf = useMemo(() => pathStages(phases, cardOrigins), [phases, cardOrigins]);
  const boardPath = useMemo(
    () => ({ path, phases, settled: pathSettled }),
    [path, phases, pathSettled],
  );

  /**
   * The phase the board was opened for: `/board?phase=<id>`.
   *
   * What "N cards on your board from this phase" in the path card links to. In the address rather
   * than in router state so it survives a reload and can be opened in a second tab, and so the
   * browser's Back goes from the narrowed board to where it came from.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const pathPlace = searchParams.get("phase");

  /** What the phase is called, for the line saying the board is narrowed to it. */
  const pathPlaceTitle = useMemo(
    () =>
      pathPlace ? (path?.phases.find((phase) => phase.id === pathPlace)?.title ?? null) : null,
    [path, pathPlace],
  );

  return {
    path,
    pathSettled,
    phases,
    stageOf,
    boardPath,
    cardOrigins,
    pathPlace,
    pathPlaceTitle,
    /** Takes the phase out of the address. */
    clearPathPlace: () => setSearchParams({}, { replace: true }),
  };
}
