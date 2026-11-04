import { SidePanel } from "../../../../components/ui/SidePanel";
import { StepOriginBadge } from "../../../onboarding";
import type { OnboardingTaskEndpoint } from "./stepPanel/stepPanelKit";
import type { OnboardingFeedback } from "../../../../services/teamManagementService";
import type { SkipReviewAction } from "./SkipReview";
import { StepDeleteFooter } from "./stepPanel/StepDeleteFooter";
import { StepRequests } from "./stepPanel/StepRequests";
import type { DetailOnboardingStep, TaskDraft, TaskInsertTarget } from "./stepPanel/stepPanelTypes";
import { TasksSection } from "./stepPanel/TasksSection";

type StepDetailsPanelProps = {
  step: DetailOnboardingStep;
  tasks: OnboardingTaskEndpoint[];
  doneTaskCount: number;
  actualMinutes: number | null;
  feedbackItems: OnboardingFeedback[];
  skipReason: string;
  taskInsertTarget: TaskInsertTarget;
  newTaskTitle: string;
  newTaskDescription: string;
  addingTask: boolean;
  stepActionId: string | null;
  stepToDelete: DetailOnboardingStep | null;
  taskToDelete: OnboardingTaskEndpoint | null;
  onClose: () => void;
  onRequestDeleteStep: (step: DetailOnboardingStep) => void;
  onCancelDeleteStep: () => void;
  onConfirmDeleteStep: (step: DetailOnboardingStep) => void;
  onRequestDeleteTask: (task: OnboardingTaskEndpoint) => void;
  onCancelDeleteTask: () => void;
  onConfirmDeleteTask: (task: OnboardingTaskEndpoint) => void;
  onTaskInsertTargetChange: (target: TaskInsertTarget) => void;
  onNewTaskTitleChange: (value: string) => void;
  onNewTaskDescriptionChange: (value: string) => void;
  onCreateTask: () => void;
  formatMinutes: (minutes?: number | null) => string;
  getStepStatusStyles: (status: string) => string;
  onReorderTasks?: (activeTaskId: string, overTaskId: string) => void;
  /** Answers the step's open skip request; the review controls only show when this is given. */
  onReviewSkip?: (skipId: string, action: SkipReviewAction, comment: string) => Promise<void>;
  /** Marks a piece of feedback as read; the button only shows when this is given. */
  onMarkFeedbackRead?: (feedbackId: string) => void;
  /** The feedback currently being marked, to hold its button while the request runs. */
  markingFeedbackId?: string | null;
};

function StepTimes({ estimate, actual }: { estimate: string; actual: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2">
        <p className="text-app-text-muted">Estimate</p>
        <p className="mt-1 font-semibold text-app-text">{estimate}</p>
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface-muted px-3 py-2">
        <p className="text-app-text-muted">Actual</p>
        <p className="mt-1 font-semibold text-app-text">{actual}</p>
      </div>
    </div>
  );
}

/**
 * One step of a member's onboarding path in the profile's side panel: its tasks (add, reorder,
 * delete), the member's feedback on it, and the review of an open skip request.
 *
 * Holds no data of its own. `TeamMemberDetailPage` owns the step, the drafts and every request;
 * the panel renders them and reports what the manager did. Optional callbacks switch their
 * controls off when they are not given.
 */
export function StepDetailsPanel(props: StepDetailsPanelProps) {
  const { step, tasks, actualMinutes, formatMinutes } = props;
  const draft: TaskDraft = {
    stepId: step.id,
    taskInsertTarget: props.taskInsertTarget,
    newTaskTitle: props.newTaskTitle,
    newTaskDescription: props.newTaskDescription,
    addingTask: props.addingTask,
    onTaskInsertTargetChange: props.onTaskInsertTargetChange,
    onNewTaskTitleChange: props.onNewTaskTitleChange,
    onNewTaskDescriptionChange: props.onNewTaskDescriptionChange,
    onCreateTask: props.onCreateTask,
  };

  return (
    <SidePanel
      isOpen
      onClose={props.onClose}
      title={step.title}
      description={step.description}
      badge={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${props.getStepStatusStyles(step.status)}`}
          >
            {step.status.replace("_", " ")}
          </span>
          <StepOriginBadge step={step} viewer="reviewer" />
        </div>
      }
      panelBackgroundClassName="bg-app-surface"
      headerDividerClassName=""
      footerClassName="border-t border-app-border bg-app-surface px-6 py-5"
      closeAriaLabel="Close step details"
      footer={
        <StepDeleteFooter
          step={step}
          stepToDelete={props.stepToDelete}
          stepActionId={props.stepActionId}
          onRequestDelete={props.onRequestDeleteStep}
          onCancel={props.onCancelDeleteStep}
          onConfirm={props.onConfirmDeleteStep}
        />
      }
    >
      <StepTimes
        estimate={formatMinutes(step.estimatedMinutes)}
        actual={actualMinutes ? formatMinutes(actualMinutes) : "Open"}
      />

      <TasksSection
        tasks={tasks}
        doneTaskCount={props.doneTaskCount}
        draft={draft}
        stepActionId={props.stepActionId}
        taskToDelete={props.taskToDelete}
        onRequestDeleteTask={props.onRequestDeleteTask}
        onCancelDeleteTask={props.onCancelDeleteTask}
        onConfirmDeleteTask={props.onConfirmDeleteTask}
        onReorderTasks={props.onReorderTasks}
      />

      <StepRequests
        step={step}
        skipReason={props.skipReason}
        feedbackItems={props.feedbackItems}
        onReviewSkip={props.onReviewSkip}
        onMarkFeedbackRead={props.onMarkFeedbackRead}
        markingFeedbackId={props.markingFeedbackId ?? null}
      />
    </SidePanel>
  );
}
