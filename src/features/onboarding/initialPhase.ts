import { phaseItems, phaseState } from "./journey";
import { resolveNextAction } from "./nextAction";
import type { OnboardingPathEndpoint, OnboardingPhaseEndpoint } from "../../services/onboardingTypes";

/** A phase the visit named, or the one holding the item it was sent for. */
function requestedPhase(
  phases: OnboardingPhaseEndpoint[],
  focusItemId: string | undefined,
  openPhaseId: string | undefined,
): OnboardingPhaseEndpoint | undefined {
  // A phase asked for by name wins over everything: whoever sent the member here was pointing at
  // it, and landing them somewhere else answers a question they did not ask.
  const named = openPhaseId ? phases.find((phase) => phase.id === openPhaseId) : undefined;
  if (named) return named;
  return focusItemId
    ? phases.find((phase) => phaseItems(phase).some((item) => item.id === focusItemId))
    : undefined;
}

/** The phase a visit opens on: what the member was sent for, else where they are, else a choice. */
export function initialPhaseId(
  path: OnboardingPathEndpoint,
  phases: OnboardingPhaseEndpoint[],
  focusItemId: string | undefined,
  openPhaseId: string | undefined,
): string {
  const requested = requestedPhase(phases, focusItemId, openPhaseId);
  if (requested) return requested.id;
  const next = resolveNextAction(path);
  if (next.kind === "step" || next.kind === "question") return next.phase.id;
  if (next.kind === "choose") return next.phases[0].id;
  return (
    (phases.find((phase) => phaseState(phase) !== "done") ?? phases[phases.length - 1])?.id ?? ""
  );
}
