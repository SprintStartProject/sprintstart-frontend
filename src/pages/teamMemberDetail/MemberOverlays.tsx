import { AlertDialog } from "../../components/ui/AlertDialog";
import { PanelPresence } from "../../components/ui/PanelPresence";
import { MemberDetailDialogs } from "../../features/team-management/components/detail/MemberDetailDialogs";
import { PhaseCheckAdminModal } from "../../features/team-management/components/detail/PhaseCheckAdminModal";
import { StepDetailsPanel } from "../../features/team-management/components/detail/StepDetailsPanel";
import type { TeamOverviewUser } from "../../features/team-management/types";
import { formatMinutes, getStepStatusStyles } from "./memberRules";
import type { MemberView } from "./memberView";
import type { MemberPageModel } from "./useMemberPage";

type OverlayProps = {
  user: TeamOverviewUser;
  model: MemberPageModel;
  view: MemberView;
  userId: string | undefined;
};

/** The dialogs of the page: removing a role, the knowledge checks, rebuilding, deleting a step. */
export function MemberDialogs({ user, model, view, userId }: OverlayProps) {
  const { roles, checkModal, setCheckModal, rebuild, editing, data } = model;
  const { graphStepToDelete, setGraphStepToDelete, remove } = editing.steps;

  return (
    <>
      <MemberDetailDialogs
        firstName={user.firstname}
        roleToRemove={roles.roleToRemove}
        savingRoleId={roles.savingRoleId}
        onCancelRoleRemove={() => roles.setRoleToRemove(null)}
        onConfirmRoleRemove={(role) => {
          void roles.remove(role.id);
          roles.setRoleToRemove(null);
        }}
      />
      {checkModal && view.checkModalPhase && userId && (
        <PhaseCheckAdminModal
          userId={userId}
          phaseId={view.checkModalPhase.id}
          phaseTitle={view.checkModalPhase.title}
          memberName={`${user.firstname} ${user.lastname}`.trim()}
          initialTab={checkModal.tab}
          onSaved={() => void data.refreshOnboardingPath()}
          onClose={() => setCheckModal(null)}
        />
      )}
      <AlertDialog
        isOpen={rebuild.confirming}
        title={`Rebuild ${user.firstname}'s onboarding path?`}
        description={`The path is put together again from the project's current blueprint and knowledge base. ${user.firstname}'s progress on the current path is replaced.`}
        confirmLabel="Rebuild path"
        variant="danger"
        onClose={() => rebuild.setConfirming(false)}
        onConfirm={rebuild.start}
      />
      <AlertDialog
        isOpen={graphStepToDelete !== null}
        title="Delete this step?"
        description={`"${view.allSteps.find((step) => step.id === graphStepToDelete)?.title ?? "The step"}" is removed from ${user.firstname}'s path. Whatever waited on it waits on what it waited on instead.`}
        confirmLabel="Delete step"
        variant="danger"
        isLoading={editing.actionId === graphStepToDelete}
        onClose={() => setGraphStepToDelete(null)}
        onConfirm={() => {
          const step = view.allSteps.find((candidate) => candidate.id === graphStepToDelete);
          // Gone since the dialog opened (a refetch): nothing left to delete, so just close.
          if (!step) setGraphStepToDelete(null);
          else void remove(step).finally(() => setGraphStepToDelete(null));
        }}
      />
    </>
  );
}

/** The panel of the open step, sliding in over the page. */
export function MemberStepPanel({ model, view }: Omit<OverlayProps, "user" | "userId">) {
  const { route, skips, feedback, editing } = model;
  const { steps, tasks } = editing;
  const { draft } = tasks;

  return (
    <PanelPresence value={view.detailStep}>
      {(step) => (
        <StepDetailsPanel
          step={step}
          tasks={view.detailTasks}
          doneTaskCount={view.detailDoneTasks}
          actualMinutes={view.detailActualMinutes}
          feedbackItems={view.detailFeedback}
          skipReason={view.detailSkipReason}
          taskInsertTarget={draft.insertTarget}
          newTaskTitle={draft.title}
          newTaskDescription={draft.description}
          addingTask={tasks.adding}
          stepActionId={editing.actionId}
          stepToDelete={steps.stepToDelete}
          taskToDelete={tasks.taskToDelete}
          onClose={() => route.setDetailStepId("")}
          onRequestDeleteStep={steps.setStepToDelete}
          onCancelDeleteStep={() => steps.setStepToDelete(null)}
          onConfirmDeleteStep={(target) => void steps.remove(target)}
          onRequestDeleteTask={tasks.setTaskToDelete}
          onCancelDeleteTask={() => tasks.setTaskToDelete(null)}
          onConfirmDeleteTask={(task) => void tasks.remove(task)}
          onTaskInsertTargetChange={draft.setInsertTarget}
          onNewTaskTitleChange={draft.setTitle}
          onNewTaskDescriptionChange={draft.setDescription}
          onCreateTask={() => void tasks.create()}
          formatMinutes={formatMinutes}
          getStepStatusStyles={getStepStatusStyles}
          onReviewSkip={skips.review}
          onMarkFeedbackRead={(feedbackId) => void feedback.markRead(feedbackId)}
          markingFeedbackId={feedback.markingId}
          onReorderTasks={(activeTaskId, overTaskId) =>
            void tasks.reorder(step.id, activeTaskId, overTaskId)
          }
        />
      )}
    </PanelPresence>
  );
}
