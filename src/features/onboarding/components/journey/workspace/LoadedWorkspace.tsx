import { useEffect, useState } from "react";
import { useToast } from "../../../../../context/useToast";
import { useMoments } from "../../../../moments";
import type { OnboardingStepDetail } from "../../../types";
import { FeedbackDrawer, SkipDrawer } from "./Drawers";
import { FeedbackNotice, SkipNotice } from "./StepNotices";
import { StepFooter } from "./StepFooter";
import { StepHeader } from "./StepHeader";
import { SidePanel, TasksPanel } from "./TasksAndResources";
import { completeStep, requestSkip, sendFeedback, startStep, toggleTask } from "./stepActions";
import type { ActionEnv } from "./stepActions";
import type { useStepData } from "./useStepData";
import { skipStateOf, taskProgress } from "./workspaceRules";
import type { Busy, Drawer } from "./workspaceRules";

type StepData = ReturnType<typeof useStepData>;

type LoadedProps = {
  step: OnboardingStepDetail;
  data: StepData;
  onPathChanged: () => Promise<void> | void;
  continueLabel: string;
  onContinue: () => void;
  isFocus: boolean;
};

/** A minute-resolution clock, so "on it for 12 min" keeps counting without a reload. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

/** The step once it is read: its notices, tasks and side panel, drawers and footer. */
export function LoadedWorkspace(props: LoadedProps) {
  const { step, data, isFocus } = props;
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const now = useNow();
  const env = useActionEnv({ ...props, setDrawer, setBusy });
  const { drafts, setters } = data;

  const progress = taskProgress(data.tasks);
  const skipState = skipStateOf(step);
  const outcomes = step.expectedOutcomes ?? [];
  const hasSide = data.resources.length > 0 || outcomes.length > 0;
  const toggleDrawer = (kind: Exclude<Drawer, null>) =>
    setDrawer((current) => (current === kind ? null : kind));

  return (
    <div className={isFocus ? "space-y-5" : "space-y-4"}>
      <StepHeader step={step} now={now} isFocus={isFocus} />

      {skipState ? <SkipNotice step={step} state={skipState} /> : null}
      {drafts.feedbackSent && drawer !== "feedback" ? (
        <FeedbackNotice helpful={drafts.helpful} comment={drafts.comment} />
      ) : null}

      <div className={`grid gap-4 ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
        <div className="min-w-0 space-y-3">
          <TasksPanel
            tasks={data.tasks}
            progress={progress}
            onToggle={(task) => void toggleTask(env, task)}
          />
        </div>

        {hasSide ? <SidePanel outcomes={outcomes} resources={data.resources} /> : null}
      </div>

      <OpenDrawer
        drawer={drawer}
        busy={busy}
        drafts={drafts}
        setters={setters}
        onCancel={() => setDrawer(null)}
        onSkip={() => void requestSkip(env)}
        onFeedback={() => void sendFeedback(env)}
      />

      <StepFooter
        step={step}
        drawer={drawer}
        busy={busy}
        skipPending={skipState === "pending"}
        feedbackSent={drafts.feedbackSent}
        progress={progress}
        continueLabel={props.continueLabel}
        onToggleDrawer={toggleDrawer}
        onStart={() => void startStep(env)}
        onComplete={() => void completeStep(env)}
        onContinue={props.onContinue}
      />
    </div>
  );
}

type OpenDrawerProps = {
  drawer: Drawer;
  busy: Busy;
  drafts: StepData["drafts"];
  setters: StepData["setters"];
  onCancel: () => void;
  onSkip: () => void;
  onFeedback: () => void;
};

/** Whichever of the two drawers is open, if any. */
function OpenDrawer(props: OpenDrawerProps) {
  const { drawer, busy, drafts, setters } = props;

  if (drawer === "skip") {
    return (
      <SkipDrawer
        reason={drafts.skipReason}
        busy={busy === "skip"}
        onReasonChange={setters.setSkipReason}
        onCancel={props.onCancel}
        onSubmit={props.onSkip}
      />
    );
  }

  if (drawer === "feedback") {
    return (
      <FeedbackDrawer
        helpful={drafts.helpful}
        comment={drafts.comment}
        busy={busy === "feedback"}
        onHelpfulChange={setters.setHelpful}
        onCommentChange={setters.setComment}
        onCancel={props.onCancel}
        onSubmit={props.onFeedback}
      />
    );
  }

  return null;
}

function useActionEnv(
  input: LoadedProps & {
    setDrawer: (drawer: Drawer) => void;
    setBusy: (busy: Busy) => void;
  },
): ActionEnv {
  const toast = useToast();
  const { flyby } = useMoments();
  const { step, data } = input;

  return {
    step,
    drafts: data.drafts,
    setStep: data.setStep,
    setTasks: data.setTasks,
    setBusy: input.setBusy,
    setDrawer: input.setDrawer,
    setFeedbackSent: data.setters.setFeedbackSent,
    onPathChanged: input.onPathChanged,
    toast,
    flyby,
  };
}
