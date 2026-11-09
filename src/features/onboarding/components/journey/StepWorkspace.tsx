import { AlertCircle, Loader2 } from "lucide-react";
import type { OnboardingStepDetail } from "../../../../services/onboardingTypes";
import { LoadedWorkspace } from "./workspace/LoadedWorkspace";
import { useStepData } from "./workspace/useStepData";

type Props = {
  stepId: string;
  /**
   * What the path says this step's status is. Not rendered -- the loaded step is what is shown --
   * but a change re-reads the step, which is how a start that happened outside this component
   * lands here. Opening a WAITING step fires `PUT /start` and this `GET` in the same tick, so the
   * read frequently came back WAITING and left "Start step" on a step that had already begun.
   */
  stepStatus?: OnboardingStepDetail["status"];
  /** Re-reads the path after anything that changes it: a start, a completion, a skip request. */
  onPathChanged: () => Promise<void> | void;
  /**
   * The member is looking at an answered skip request whose answer is still marked new.
   *
   * Called from here rather than from whatever opened the step: "opened" includes "Up next",
   * "Continue" and "Start now", so the answer was marked seen as part of moving the member on --
   * before it had been drawn -- and a deep link, which sets the open step directly, never marked
   * it at all.
   */
  onSkipAnswerSeen?: (skipId: string) => void;
  /** Where "continue" leads once the step is behind the member; the page works it out. */
  continueLabel: string;
  onContinue: () => void;
  /** `inline` sits inside a list row; `focus` fills the graph when zoomed into a step. */
  layout?: "inline" | "focus";
};

/**
 * A step, worked through where it is.
 *
 * Replaces the separate step page: opening a step there meant leaving the path, and coming back meant
 * finding one's place in it again. Here the step unfolds inside the list row -- or fills the graph when
 * zoomed into -- with its tasks, what it should lead to and what helps, and completing it moves on
 * without the path ever leaving the screen. Skipping and feedback stay one click away but out of the
 * way, since most steps need neither.
 */
export function StepWorkspace({
  stepId,
  stepStatus,
  onPathChanged,
  onSkipAnswerSeen,
  continueLabel,
  onContinue,
  layout = "inline",
}: Props) {
  const data = useStepData({ stepId, stepStatus, onSkipAnswerSeen });

  if (data.error) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Could not load this step: {data.error}
      </div>
    );
  }

  if (!data.step) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-sm text-app-text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-app-brand" aria-hidden="true" />
        Loading step…
      </div>
    );
  }

  return (
    <LoadedWorkspace
      step={data.step}
      data={data}
      onPathChanged={onPathChanged}
      continueLabel={continueLabel}
      onContinue={onContinue}
      isFocus={layout === "focus"}
    />
  );
}
