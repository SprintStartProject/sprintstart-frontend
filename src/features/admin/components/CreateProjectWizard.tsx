import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Stepper } from "../../../components/ui/Stepper";
import { useToast } from "../../../context/useToast";
import {
  projectService,
  type AdminProjectDetails,
  type ProjectManager,
} from "../../../services/projectService";
import { AddSourceFlow } from "../../data-ingestion/add-source/AddSourceFlow";
import { COMPANION_GAP, COMPANION_WIDTH } from "../../data-ingestion/add-source/CredentialSlot";
import {
  addDraftSources,
  connectDraftSources,
  connectOutcomeDescription,
  hasFailedSources,
  removeDraftSource,
  setDraftSourceOwner,
  type DraftSource,
} from "../../data-ingestion/add-source/projectSourcesDraft";
import { sortOwnerOptions } from "../../data-ingestion/add-source/sourceOwners";
import { useSourceDraftForm } from "../../data-ingestion/add-source/useSourceDraftForm";
import { getDisplayName } from "../data";
import { getMovedUsers } from "../projectMove";
import type { AdminUser } from "../types";
import { WizardDetailsStep } from "./wizard/steps/WizardDetailsStep";
import { WizardMembersStep } from "./wizard/steps/WizardMembersStep";
import { WizardSourcesStep } from "./wizard/steps/WizardSourcesStep";
import { WizardReviewStep, type ReviewPerson } from "./wizard/steps/WizardReviewStep";
import { WizardProvisioning } from "./wizard/steps/WizardProvisioning";

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

/** The four editable steps plus the terminal provisioning screen. */
type WizardPhase = "details" | "members" | "sources" | "review" | "provisioning";

const STEP_LABELS = ["Details", "Members", "Sources", "Review"];
const STEP_INDEX: Record<Exclude<WizardPhase, "provisioning">, number> = {
  details: 0,
  members: 1,
  sources: 2,
  review: 3,
};

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

  const [name, setName] = useState("");
  // Turns the "Name is required" message on only after the user has left the
  // field or tried to advance, so the step never opens already showing red.
  const [nameTouched, setNameTouched] = useState(false);
  // A name conflict reported by the backend at commit time (the client list may
  // be stale). Cleared as soon as the name is edited.
  const [nameServerError, setNameServerError] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [managerId, setManagerId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

  const [managerCandidates, setManagerCandidates] = useState<ProjectManager[]>([]);
  // Starts true so the manager picker reads "Loading candidates..." on first
  // paint instead of flashing "No candidates available" before the fetch begins.
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [candidatesError, setCandidatesError] = useState("");

  const [sources, setSources] = useState<DraftSource[]>([]);

  // Add-source sub-flow, shown over the Sources step.
  const addForm = useSourceDraftForm();

  const [createdProjectId, setCreatedProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guards the "discard unsaved work?" confirmation over a dirty wizard.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const toast = useToast();

  const trimmedName = name.trim();

  // Case-insensitive clash with an existing project, only once something is
  // typed. The server error takes precedence over both other messages.
  const nameCollision =
    trimmedName.length > 0 &&
    existingProjectNames.some(
      (existing) => existing.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

  const isNameValid = trimmedName.length > 0 && !nameCollision;

  const nameError = nameServerError
    ? nameServerError
    : nameCollision
      ? "A project with this name already exists."
      : nameTouched && trimmedName.length === 0
        ? "Name is required."
        : "";

  const handleNameChange = (value: string) => {
    setName(value);
    // Any edit invalidates a stale server-side "already exists".
    if (nameServerError) setNameServerError("");
  };

  const loadManagerCandidates = useCallback(async () => {
    setIsLoadingCandidates(true);
    setCandidatesError("");

    try {
      setManagerCandidates(await projectService.getManagerCandidates());
    } catch (error) {
      setCandidatesError(
        error instanceof Error ? error.message : "Manager candidates could not be loaded.",
      );
    } finally {
      setIsLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Deferred so the fetch is not a synchronous state update inside the
    // effect body, which `react-hooks/set-state-in-effect` rejects.
    void Promise.resolve().then(loadManagerCandidates);
  }, [isOpen, loadManagerCandidates]);

  const resetWizard = () => {
    setPhase("details");
    setName("");
    setNameTouched(false);
    setNameServerError("");
    setConfirmingClose(false);
    setDescription("");
    setIndustry("");
    setManagerId("");
    setSelectedUserIds(new Set());
    setSources([]);
    addForm.reset();
    setCreatedProjectId("");
  };

  const closeWizard = () => {
    if (isSubmitting) return;

    resetWizard();
    onClose();
  };

  // Anything the user has drafted that a close would throw away. The provisioning
  // screen is excluded — the project already exists there, so there is nothing
  // to discard and closing just dismisses the status view.
  const isDirty =
    trimmedName.length > 0 ||
    description.trim().length > 0 ||
    industry.trim().length > 0 ||
    Boolean(managerId) ||
    selectedUserIds.size > 0 ||
    sources.length > 0;

  // Every dismissal path (backdrop, Escape, the header ✕, the footer Cancel)
  // routes through here so a dirty wizard asks before discarding.
  const requestClose = () => {
    if (isSubmitting) return;

    if (phase !== "provisioning" && isDirty) {
      setConfirmingClose(true);
      return;
    }

    closeWizard();
  };

  const confirmDiscard = () => {
    setConfirmingClose(false);
    closeWizard();
  };

  // The manager for Review, resolved from the user directory when possible so
  // the avatar matches the one shown elsewhere; the manager-candidate list has
  // no profile icon, so a candidate-only manager falls back to a name-seeded one.
  const reviewManager = useMemo<ReviewPerson | null>(() => {
    if (!managerId) return null;

    const fromDirectory = users.find((user) => user.id === managerId);
    if (fromDirectory) {
      return {
        id: fromDirectory.id,
        name: getDisplayName(fromDirectory),
        profileIcon: fromDirectory.profileIcon,
      };
    }

    const candidate = managerCandidates.find((current) => current.id === managerId);
    if (!candidate) return null;

    const fullName = `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim();
    return { id: candidate.id, name: fullName || candidate.username };
  }, [users, managerCandidates, managerId]);

  // Picked members who are in other projects already and would be moved. The
  // project does not exist yet, so no membership can match it: an empty target id
  // makes every current project of a regular user count as one they leave.
  const movedUsers = useMemo(
    () => getMovedUsers(users, selectedUserIds, ""),
    [users, selectedUserIds],
  );

  // Members shown on Review, excluding the manager (rendered separately there).
  const reviewMembers = useMemo<ReviewPerson[]>(() => {
    const leavingByUserId = new Map(
      movedUsers.map(({ user, leaving }) => [user.id, leaving.map((project) => project.name)]),
    );

    return users
      .filter((user) => selectedUserIds.has(user.id) && user.id !== managerId)
      .map((user) => ({
        id: user.id,
        name: getDisplayName(user),
        profileIcon: user.profileIcon,
        movedFrom: leavingByUserId.get(user.id),
      }));
  }, [users, selectedUserIds, managerId, movedUsers]);

  const memberCount = selectedUserIds.size + (managerId && !selectedUserIds.has(managerId) ? 1 : 0);

  /*
    Who a staged repository can be handed to: the people this project is being created with.
    The whole directory would be the wrong list — an owner who is not on the project cannot be
    told about the gap, and the Members step is right behind this one, so a missing name is a
    step back rather than a dead end. The manager is included even when they were not ticked as
    a member, because setting them as manager makes them one.
  */
  const ownerOptions = useMemo(
    () =>
      sortOwnerOptions(
        users
          .filter((user) => selectedUserIds.has(user.id) || user.id === managerId)
          .map((user) => ({ value: user.id, label: getDisplayName(user) })),
      ),
    [users, selectedUserIds, managerId],
  );

  // --- Add-source sub-flow ---

  const commitAddSource = () => {
    if (!addForm.canAdd) return;

    const drafts = addForm.commit();
    setSources((current) => addDraftSources(current, drafts));
  };

  // --- Commit + provisioning ---

  /** Creates the project and assigns its people. Guarded so a retry never
   * creates a second project. */
  const ensureProject = async (): Promise<string> => {
    if (createdProjectId) return createdProjectId;

    const trimmedIndustry = industry.trim();

    const project = await projectService.createProject({
      name: trimmedName,
      description: description.trim() || undefined,
      industry: trimmedIndustry || undefined,
    });

    // Members before the manager: assigning a manager also makes them a member,
    // so the reverse order would depend on the id order.
    let members = project.users;
    if (selectedUserIds.size > 0) {
      members = await projectService.assignUsersToProject(project.id, {
        userIds: [...selectedUserIds],
      });

      if (movedUsers.length > 0) onMembershipsMoved?.();
    }

    // Setting the manager returns the full, backend-authoritative details
    // (manager plus the complete member list), so prefer that response. Without
    // a manager, the created-project response predates the member assignment, so
    // the members are folded back in before the page adds it to its list.
    const finalProject = managerId
      ? await projectService.setProjectManager(project.id, managerId)
      : { ...project, users: members };

    setCreatedProjectId(project.id);
    onProjectCreated(finalProject);

    return project.id;
  };

  const handleCreate = async () => {
    if (isSubmitting) return;

    // A shortcut ("Create, skip review") could fire with an invalid name; send
    // the user back to Details with the error rather than failing silently.
    if (!isNameValid) {
      setPhase("details");
      setNameTouched(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const projectId = await ensureProject();

      if (sources.length === 0) {
        resetWizard();
        onClose();
        toast.success("Project created");
        return;
      }

      setPhase("provisioning");

      const connected = await connectDraftSources(projectId, sources, setSources);

      if (hasFailedSources(connected)) {
        // The project is saved; the failed rows stay on the provisioning screen
        // with a retry. The per-source rows show which failed; the toast sums up.
        toast.warning("Project created", {
          description: "Some sources couldn't be connected.",
        });
      } else {
        toast.success("Project created", {
          description: connectOutcomeDescription(connected),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't create the project.";

      // A name clash the client list missed comes back here (the project was
      // never created). Send the user to Details with the field flagged rather
      // than only flashing a toast they have to decode.
      if (!createdProjectId && /name.*(exist|taken|already|duplicate)/i.test(message)) {
        setPhase("details");
        setNameTouched(true);
        setNameServerError("A project with this name already exists.");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const retrySource = async (sourceId: string) => {
    const source = sources.find((current) => current.id === sourceId);
    if (!source || !createdProjectId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const retried = await connectDraftSources(createdProjectId, [source], (progressSources) =>
        setSources((current) =>
          current.map(
            (currentSource) =>
              progressSources.find((progress) => progress.id === currentSource.id) ?? currentSource,
          ),
        ),
      );

      if (hasFailedSources(retried)) {
        toast.error("Couldn't connect the source.");
      } else {
        toast.success("Source connected", {
          description: connectOutcomeDescription(retried),
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Rendering ---

  const isProvisioning = phase === "provisioning";
  const stepIndex = isProvisioning ? STEP_INDEX.review : STEP_INDEX[phase];

  // Announced to screen readers on every screen change, and used as the target
  // for focus so keyboard users land at the top of the new content rather than
  // keeping focus on the footer button they just pressed.
  const screenAnnouncement = isProvisioning
    ? "Creating project"
    : addForm.isOpen
      ? addForm.step === "type"
        ? "Add a source: choose a type"
        : "Add a source: enter the details"
      : `Step ${stepIndex + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[stepIndex]}`;

  const bodyRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);
  useEffect(() => {
    // Skip the initial mount so this does not fight the Modal's own autofocus.
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      return;
    }
    bodyRef.current?.focus();
  }, [phase, addForm.isOpen, addForm.step]);

  const goBack = () => {
    if (phase === "members") setPhase("details");
    else if (phase === "sources") setPhase("members");
    else if (phase === "review") setPhase("sources");
  };

  const goForward = () => {
    if (phase === "details") {
      // Continue stays enabled so the click can explain itself: an invalid name
      // reveals the inline error and keeps the user on the step instead of a
      // silently disabled button.
      if (!isNameValid) {
        setNameTouched(true);
        return;
      }
      setPhase("members");
    } else if (phase === "members") setPhase("sources");
    else if (phase === "sources") setPhase("review");
  };

  // Backwards jump from the stepper. Any in-progress add-source sub-flow is
  // closed first so the target step renders its own content, not the sub-flow.
  const goToStep = (index: number) => {
    if (isSubmitting) return;
    if (addForm.isOpen) addForm.close();

    const target = (["details", "members", "sources", "review"] as const)[index];
    if (target) setPhase(target);
  };

  const skipLabel = sources.length === 0 ? "Create without sources" : "Create, skip review";

  const footer = (() => {
    if (isProvisioning) {
      return (
        <Button
          variant="primary"
          onClick={closeWizard}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Done
        </Button>
      );
    }

    if (addForm.isOpen) {
      if (addForm.step === "type") {
        return (
          <Button
            variant="secondary"
            onClick={addForm.close}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="sm:mr-auto"
          >
            Back to source list
          </Button>
        );
      }

      // The detail screen's "back to types" lives in its own navigation header
      // (master-detail), so the footer carries only the primary action.
      return (
        <Button
          variant="primary"
          onClick={commitAddSource}
          disabled={!addForm.canAdd}
          icon={<Plus className="h-4 w-4" />}
        >
          Add to list
        </Button>
      );
    }

    const isDetails = phase === "details";

    return (
      <>
        <Button
          variant="secondary"
          onClick={isDetails ? requestClose : goBack}
          disabled={isSubmitting}
          icon={isDetails ? undefined : <ArrowLeft className="h-4 w-4" />}
          className="sm:mr-auto"
        >
          {isDetails ? "Cancel" : "Back"}
        </Button>

        {phase === "sources" && (
          <Button variant="secondary" onClick={() => void handleCreate()} loading={isSubmitting}>
            {skipLabel}
          </Button>
        )}

        {phase === "review" ? (
          <Button
            variant="primary"
            onClick={() => void handleCreate()}
            loading={isSubmitting}
            disabled={!isNameValid}
            icon={<Check className="h-4 w-4" />}
          >
            Create project
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={goForward}
            disabled={isSubmitting}
            trailingIcon={<ArrowRight className="h-4 w-4" />}
          >
            Continue
          </Button>
        )}
      </>
    );
  })();

  return (
    <>
      <Modal
        isOpen={isOpen}
        title="New Project"
        description={
          isProvisioning ? (
            <p className="text-sm font-medium text-app-text">Creating project…</p>
          ) : (
            <Stepper steps={STEP_LABELS} current={stepIndex} onStepSelect={goToStep} />
          )
        }
        size="xl"
        isDismissDisabled={isSubmitting || confirmingClose}
        contentInsetRight={addForm.companionOpen ? COMPANION_WIDTH + COMPANION_GAP + 16 : 0}
        onClose={requestClose}
        closeLabel="Close new project wizard"
        footer={footer}
        // Keep the footer buttons side by side (up to three) instead of stacking
        // them on narrow screens; desktop keeps its natural-width, right-aligned
        // row via the sm: resets.
        footerClassName="flex flex-row flex-wrap gap-3 [&>button]:flex-1 sm:flex-nowrap sm:justify-end sm:[&>button]:flex-initial"
      >
        <p className="sr-only" aria-live="polite">
          {screenAnnouncement}
        </p>

        <div ref={bodyRef} tabIndex={-1} className="focus:outline-hidden">
          {phase === "details" && (
            <WizardDetailsStep
              name={name}
              nameError={nameError}
              description={description}
              industry={industry}
              managerId={managerId}
              managerCandidates={managerCandidates}
              isLoadingCandidates={isLoadingCandidates}
              candidatesError={candidatesError}
              onNameChange={handleNameChange}
              onNameBlur={() => setNameTouched(true)}
              onDescriptionChange={setDescription}
              onIndustryChange={setIndustry}
              onManagerChange={setManagerId}
              onSubmit={goForward}
            />
          )}

          {phase === "members" && (
            <WizardMembersStep
              users={users}
              selectedUserIds={selectedUserIds}
              managerId={managerId}
              onChange={setSelectedUserIds}
              onManagerRemoved={() => setManagerId("")}
            />
          )}

          {phase === "sources" &&
            (addForm.isOpen ? (
              <AddSourceFlow
                key={addForm.flowKey}
                step={addForm.step}
                selectedType={addForm.type}
                onSelectType={addForm.selectType}
                onBack={addForm.backToTypes}
                context={{ projectId: null, tokenNames }}
                onDraftsChange={addForm.reportDrafts}
                onSubmit={commitAddSource}
                onCompanionOpenChange={addForm.setCompanionOpen}
              />
            ) : (
              <WizardSourcesStep
                sources={sources}
                onRemove={(sourceId) =>
                  setSources((current) => removeDraftSource(current, sourceId))
                }
                ownerOptions={ownerOptions}
                onOwnerChange={(sourceId, ownerUserId) =>
                  setSources((current) => setDraftSourceOwner(current, sourceId, ownerUserId))
                }
                onAddSource={addForm.open}
              />
            ))}

          {phase === "review" && (
            <WizardReviewStep
              name={name}
              description={description}
              industry={industry}
              manager={reviewManager}
              members={reviewMembers}
              sources={sources}
              onEditDetails={() => setPhase("details")}
              onEditMembers={() => setPhase("members")}
              onEditSources={() => setPhase("sources")}
            />
          )}

          {phase === "provisioning" && (
            <WizardProvisioning
              projectName={trimmedName}
              memberCount={memberCount}
              sources={sources}
              disabled={isSubmitting}
              onRetry={(sourceId) => void retrySource(sourceId)}
            />
          )}
        </div>
      </Modal>

      <AlertDialog
        isOpen={confirmingClose}
        title="Discard this project?"
        description="The project hasn't been created yet. Closing now discards the name, members and sources you've added."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onClose={() => setConfirmingClose(false)}
        onConfirm={confirmDiscard}
      />
    </>
  );
}
