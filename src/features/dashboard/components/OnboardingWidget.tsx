import { useMyOnboardingStatus } from "../../onboarding/hooks/useMyOnboardingStatus";
import { NextStepWidget } from "./NextStepWidget";

/**
 * The onboarding card as a placeable widget.
 *
 * Reads the status itself, so the dashboard does not have to fetch on behalf of a card the
 * user may have removed. {@link NextStepWidget} renders nothing once the journey is done —
 * and the catalog stops offering this widget at the same moment, so a finished onboarding
 * leaves the board rather than leaving a blank.
 */
export function OnboardingWidget() {
  const status = useMyOnboardingStatus();

  return <NextStepWidget status={status} />;
}
