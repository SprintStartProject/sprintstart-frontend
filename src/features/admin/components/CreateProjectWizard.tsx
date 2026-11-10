import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Modal } from "../../../components/ui/Modal";
import { Stepper } from "../../../components/ui/Stepper";
import type { AdminProjectDetails } from "../../../services/projectService";
import { getMovedUsers } from "../projectMove";
import type { AdminUser } from "../types";
import {
  COMPANION_GAP,
  COMPANION_WIDTH,
  addDraftSources,
  useSourceDraftForm,
} from "./wizard/addSourceKit";
import { useCreateProject } from "./wizard/useCreateProject";
import { useManagerCandidates } from "./wizard/useManagerCandidates";
import { useWizardClose } from "./wizard/useWizardClose";
import { useWizardDraft } from "./wizard/useWizardDraft";
import { WizardBody } from "./wizard/WizardBody";
import { WizardFooter } from "./wizard/WizardFooter";
import {
  STEP_LABELS,
  isDraftDirty,
  memberCountOf,
  nameState,
  nextPhase,
  ownerOptionsFor,
  phaseAtStep,
  previousPhase,
  resolveReviewManager,
  resolveReviewMembers,
  screenAnnouncementFor,
  stepIndexOf,
  type WizardPhase,
} from "./wizard/wizardRules";

type CreateProjectWizardProps = {
  isOpen: boolean;
  tokenNames: string[];
  /**
   * The user directory, already loaded by the admin page. Passed in rather than
   * fetched here so opening the wizard does not repeat a request the page has
   * made anyway.
   */
  users: AdminUser[];
  /**
   * Names of the projects that already exist, used to flag a duplicate name on
   * the Details step before the user reaches the commit. Case-insensitive; the
   * backend stays the source of truth and its own conflict is surfaced too.
   */
  existingProjectNames?: string[];
  onClose: () => void;
  /** Fired once the project exists, before any source finished connecting. */
  onProjectCreated: (project: AdminProjectDetails) => void;
  /**
   * Fired after members were assigned who were removed from other projects by
   * it. Those projects' member lists are held elsewhere on the page and are
   * stale by then, so the parent is expected to reload them.
   */
  onMembershipsMoved?: () => void;
};

/**
 * Lands keyboard users at the top of the new content on every screen change, rather than leaving
 * focus on the footer button they just pressed. Skips the initial mount so it does not fight the
 * Modal's own autofocus.
 */
function useFocusOnScreenChange(phase: WizardPhase, subFlowOpen: boolean, subFlowStep: string) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);
  useEffect(() => {
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      return;
    }
    bodyRef.current?.focus();
  }, [phase, subFlowOpen, subFlowStep]);
  return bodyRef;
}

/**
 * Transactional create-project wizard: everything is drafted locally across the
 * Details → Members → Sources → Review steps and committed by a single "Create
 * project". That commit drives the provisioning screen, the one place real work
 * happens — the project is created, members and the manager are assigned, and
 * each staged source is connected with live per-row status and retry.
 *
 * Nothing hits the backend before that commit, so cancelling out of any step
 * leaves nothing behind. Because creating the project and connecting its sources
 * are separate calls, a source failure cannot roll the project back — the wizard
 * therefore stays on the provisioning screen and offers a per-source retry that
 * reuses the already-created project instead of making a second one.
 */
export function CreateProjectWizard({
  isOpen,
  tokenNames,
  users,
  existingProjectNames = [],
  onClose,
  onProjectCreated,
  onMembershipsMoved,
}: CreateProjectWizardProps) {
  const [phase, setPhase] = useState<WizardPhase>("details");
  const draft = useWizardDraft();
  const addForm = useSourceDraftForm();
  const managers = useManagerCandidates(isOpen);
  const { trimmedName, isNameValid, nameError } = nameState(
    draft.name,
    existingProjectNames,
    draft.nameTouched,
    draft.nameServerError,
  );
  const { selectedUserIds, managerId } = draft;

  // Picked members who are in other projects already and would be moved. The project does not exist
  // yet, so no membership can match it: an empty target id makes every current project of a regular
  // user count as one they leave.
  const movedUsers = useMemo(
    () => getMovedUsers(users, selectedUserIds, ""),
    [users, selectedUserIds],
  );
  const review = useMemo(
    () => ({
      manager: resolveReviewManager(users, managers.candidates, managerId),
      members: resolveReviewMembers(users, selectedUserIds, managerId, movedUsers),
    }),
    [users, managers.candidates, selectedUserIds, managerId, movedUsers],
  );
  const ownerOptions = useMemo(
    () => ownerOptionsFor(users, selectedUserIds, managerId),
    [users, selectedUserIds, managerId],
  );

  const reset = () => {
    setPhase("details");
    draft.reset();
    addForm.reset();
  };
  const create = useCreateProject({
    draft,
    trimmedName,
    isNameValid,
    movedCount: movedUsers.length,
    setPhase,
    onFinish: () => {
      reset();
      onClose();
    },
    onProjectCreated,
    onMembershipsMoved,
  });
  const close = useWizardClose({
    phase,
    isDirty: isDraftDirty({ ...draft, sourceCount: draft.sources.length }),
    isSubmitting: create.isSubmitting,
    reset,
    onClose,
  });

  const stepIndex = stepIndexOf(phase);
  const bodyRef = useFocusOnScreenChange(phase, addForm.isOpen, addForm.step);

  const commitAddSource = () => {
    if (!addForm.canAdd) return;

    const drafts = addForm.commit();
    draft.setSources((current) => addDraftSources(current, drafts));
  };

  const goForward = () => {
    // Continue stays enabled so the click can explain itself: an invalid name
    // reveals the inline error and keeps the user on the step instead of a
    // silently disabled button.
    if (phase === "details" && !isNameValid) {
      draft.setNameTouched(true);
      return;
    }
    setPhase(nextPhase(phase));
  };

  // Backwards jump from the stepper. Any in-progress add-source sub-flow is
  // closed first so the target step renders its own content, not the sub-flow.
  const goToStep = (index: number) => {
    if (create.isSubmitting) return;
    if (addForm.isOpen) addForm.close();

    const target = phaseAtStep(index);
    if (target) setPhase(target);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="New Project"
        description={
          phase === "provisioning" ? (
            <p className="text-sm font-medium text-app-text">Creating project…</p>
          ) : (
            <Stepper steps={STEP_LABELS} current={stepIndex} onStepSelect={goToStep} />
          )
        }
        size="xl"
        isDismissDisabled={create.isSubmitting || close.confirmingClose}
        contentInsetRight={addForm.companionOpen ? COMPANION_WIDTH + COMPANION_GAP + 16 : 0}
        onClose={close.requestClose}
        closeLabel="Close new project wizard"
        footer={
          <WizardFooter
            phase={phase}
            addForm={addForm}
            isSubmitting={create.isSubmitting}
            isNameValid={isNameValid}
            sourceCount={draft.sources.length}
            onDone={close.closeWizard}
            onCancel={close.requestClose}
            onBack={() => setPhase(previousPhase(phase))}
            onContinue={goForward}
            onCreate={() => void create.create()}
            onCommitAddSource={commitAddSource}
          />
        }
        // Keep the footer buttons side by side (up to three) instead of stacking
        // them on narrow screens; desktop keeps its natural-width, right-aligned
        // row via the sm: resets.
        footerClassName="flex flex-row flex-wrap gap-3 [&>button]:flex-1 sm:flex-nowrap sm:justify-end sm:[&>button]:flex-initial"
      >
        <p className="sr-only" aria-live="polite">
          {screenAnnouncementFor(phase, addForm)}
        </p>

        <div ref={bodyRef} tabIndex={-1} className="focus:outline-hidden">
          <WizardBody
            phase={phase}
            draft={draft}
            users={users}
            tokenNames={tokenNames}
            nameError={nameError}
            trimmedName={trimmedName}
            managers={managers}
            addForm={addForm}
            ownerOptions={ownerOptions}
            review={review}
            memberCount={memberCountOf(selectedUserIds, managerId)}
            isSubmitting={create.isSubmitting}
            onSubmitDetails={goForward}
            onGoToPhase={setPhase}
            onCommitAddSource={commitAddSource}
            onRetry={(sourceId) => void create.retrySource(sourceId)}
          />
        </div>
      </Modal>

      <AlertDialog
        isOpen={close.confirmingClose}
        title="Discard this project?"
        description="The project hasn't been created yet. Closing now discards the name, members and sources you've added."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onClose={close.keepEditing}
        onConfirm={close.confirmDiscard}
      />
    </>
  );
}
