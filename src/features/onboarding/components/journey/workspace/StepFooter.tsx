import {
  CheckCircle2,
  ChevronRight,
  MessageSquareCheck,
  PlayCircle,
  SkipForward,
  Trophy,
} from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import type { OnboardingStepDetail } from "../../../../../services/onboardingTypes";
import { isBehind, tasksToGoLabel } from "./workspaceRules";
import type { Busy, Drawer, TaskProgress } from "./workspaceRules";

type FooterProps = {
  step: OnboardingStepDetail;
  drawer: Drawer;
  busy: Busy;
  skipPending: boolean;
  feedbackSent: boolean;
  progress: TaskProgress;
  continueLabel: string;
  onToggleDrawer: (drawer: Exclude<Drawer, null>) => void;
  onStart: () => void;
  onComplete: () => void;
  onContinue: () => void;
};

/** Skip and feedback, one click away but out of the way, and the one thing the step needs next. */
export function StepFooter(props: FooterProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-app-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1">
        {!isBehind(props.step) ? (
          <button
            type="button"
            disabled={props.skipPending}
            aria-expanded={props.drawer === "skip"}
            onClick={() => props.onToggleDrawer("skip")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-1.5 text-xs font-semibold text-app-warning-text transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            {props.skipPending ? "Skip requested" : "Skip"}
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={props.drawer === "feedback"}
          onClick={() => props.onToggleDrawer("feedback")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-app-brand-border bg-app-brand-soft px-3 py-1.5 text-xs font-semibold text-app-brand-text transition-opacity hover:opacity-90"
        >
          <MessageSquareCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {props.feedbackSent ? "Edit feedback" : "Feedback"}
        </button>
      </div>

      <PrimaryAction {...props} />
    </div>
  );
}

function PrimaryAction(props: FooterProps) {
  const { step, busy, progress } = props;

  if (step.status === "WAITING") {
    return (
      <Button
        variant="primary"
        loading={busy === "start"}
        icon={<PlayCircle className="h-4 w-4" />}
        onClick={props.onStart}
      >
        Start step
      </Button>
    );
  }

  if (isBehind(step)) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-success-text">
          <Trophy className="h-4 w-4" aria-hidden="true" />
          {step.status === "SKIPPED" ? "Skipped" : "Done"}
        </span>
        <Button
          variant="primary"
          onClick={props.onContinue}
          trailingIcon={<ChevronRight className="h-4 w-4" />}
        >
          {props.continueLabel}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      loading={busy === "complete"}
      disabled={!progress.allDone}
      icon={<CheckCircle2 className="h-4 w-4" />}
      onClick={props.onComplete}
    >
      {progress.allDone ? "Mark as complete" : tasksToGoLabel(progress.total - progress.done)}
    </Button>
  );
}
