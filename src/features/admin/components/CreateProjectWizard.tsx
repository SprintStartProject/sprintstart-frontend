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
import {
  addDraftSource,
  connectDraftSources,
  createDraftSourceFromDiscovery,
  createJiraDraft,
  createUploadDraft,
  hasFailedSources,
  removeDraftSource,
  type DraftSource,
} from "../projectSourcesDraft";
import type { DiscoverySelection } from "../../data-ingestion/components/GithubRepositoryDiscovery";
import type { SourceSystem } from "../../data-ingestion/types";
import { useJiraCredentials } from "../../settings/hooks/useJiraCredentials";
import { useGithubTokens } from "../../settings/hooks/useGithubTokens";
import { getDisplayName } from "../data";
import type { AdminUser } from "../types";
import { WizardDetailsStep } from "./wizard/steps/WizardDetailsStep";
import { WizardMembersStep } from "./wizard/steps/WizardMembersStep";
import { WizardSourcesStep } from "./wizard/steps/WizardSourcesStep";
import { WizardReviewStep, type ReviewPerson } from "./wizard/steps/WizardReviewStep";
import { WizardProvisioning } from "./wizard/steps/WizardProvisioning";
import {
  AddSourceFlow,
  COMPANION_GAP,
  COMPANION_WIDTH,
  type AddSourceStep,
} from "./wizard/sources/AddSourceFlow";

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

// All three connectors can now be staged from the add-source sub-flow.
const AVAILABLE_SOURCE_TYPES: SourceSystem[] = ["GITHUB", "JIRA", "UPLOAD"];

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
  const [managerId, setManagerId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

  const [managerCandidates, setManagerCandidates] = useState<ProjectManager[]>([]);
  // Starts true so the manager picker reads "Loading candidates..." on first
  // paint instead of flashing "No candidates available" before the fetch begins.
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [candidatesError, setCandidatesError] = useState("");

  const [sources, setSources] = useState<DraftSource[]>([]);

  // Add-source sub-flow, shown over the Sources step. `addFlowKey` remounts the
  // GitHub picker on each open so a new "Add source" starts from a clean slate.
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addStep, setAddStep] = useState<AddSourceStep>("type");
  const [addType, setAddType] = useState<SourceSystem>("GITHUB");
  const [addFlowKey, setAddFlowKey] = useState(0);
  const [githubSelection, setGithubSelection] = useState<DiscoverySelection[]>([]);
  const [githubTokenName, setGithubTokenName] = useState(tokenNames[0] ?? "");

  // The token list is owned here so an inline "add token" can refresh it and
  // auto-select the new token. It falls back to the prop until it has loaded so
  // discovery still works on the first open without waiting for the refetch.
  const { tokenNames: loadedTokenNames, tokensLoaded, loadTokenNames } = useGithubTokens();
  const effectiveTokenNames = tokensLoaded ? loadedTokenNames : tokenNames;
  const prevTokenNamesRef = useRef<string[]>([]);
  const [awaitingNewToken, setAwaitingNewToken] = useState(false);

  const [jiraDisplayName, setJiraDisplayName] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraCredentialName, setJiraCredentialName] = useState("");

  // Upload files staged in memory; uploaded during provisioning once a project
  // id exists.
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const [createdProjectId, setCreatedProjectId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // True while the desktop "add credential" companion is open, so the modal
  // slides left to make room for it beside itself.
  const [companionOpen, setCompanionOpen] = useState(false);
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

  const isJiraDetail = isAddingSource && addStep === "detail" && addType === "JIRA";
  const {
    credentials: jiraCredentials,
    loaded: jiraCredentialsLoaded,
    error: jiraCredentialsError,
    isRefreshing: jiraCredentialsLoading,
    reload: reloadJiraCredentials,
  } = useJiraCredentials(isOpen && isJiraDetail);
  const prevCredentialNamesRef = useRef<string[]>([]);
  const [awaitingNewCredential, setAwaitingNewCredential] = useState(false);

  // The token list arrives asynchronously; adopt the first token as soon as it
  // does (and heal a stale selection) so discovery is usable on the first open.
  useEffect(() => {
    if (effectiveTokenNames.length === 0) return;

    void Promise.resolve().then(() => {
      setGithubTokenName((current) =>
        current && effectiveTokenNames.includes(current) ? current : effectiveTokenNames[0],
      );
    });
  }, [effectiveTokenNames]);

  // After an inline "add token" refetch, select the one that is new so the user
  // does not have to pick it out of the list themselves.
  useEffect(() => {
    if (!awaitingNewToken) return;

    const added = effectiveTokenNames.find((name) => !prevTokenNamesRef.current.includes(name));
    if (added) setGithubTokenName(added);
    setAwaitingNewToken(false);
  }, [effectiveTokenNames, awaitingNewToken]);

  // Same adoption pattern for the Jira credential picker: select the first
  // stored credential once the list arrives, keeping a still-valid choice.
  useEffect(() => {
    if (!jiraCredentialsLoaded || jiraCredentialsLoading) return;

    void Promise.resolve().then(() => {
      setJiraCredentialName((current) => {
        if (jiraCredentials.length === 0) return "";
        return current && jiraCredentials.some((credential) => credential.displayName === current)
          ? current
          : jiraCredentials[0].displayName;
      });
    });
  }, [jiraCredentials, jiraCredentialsLoaded, jiraCredentialsLoading]);

  // Counterpart to the token effect: after an inline "add credential" refetch,
  // select the new credential. Runs after the adopt-first effect above so it
  // wins when both fire on the same credentials change.
  useEffect(() => {
    if (!awaitingNewCredential) return;

    const added = jiraCredentials.find(
      (credential) => !prevCredentialNamesRef.current.includes(credential.displayName),
    );
    if (added) setJiraCredentialName(added.displayName);
    setAwaitingNewCredential(false);
  }, [jiraCredentials, awaitingNewCredential]);

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
    setManagerId("");
    setSelectedUserIds(new Set());
    setSources([]);
    setIsAddingSource(false);
    setAddStep("type");
    setAddType("GITHUB");
    setGithubSelection([]);
    resetJiraDraftFields();
    setUploadFiles([]);
    setCreatedProjectId("");
  };

  const resetJiraDraftFields = () => {
    setJiraDisplayName("");
    setJiraUrl("");
    setJiraCredentialName("");
  };

  const resetSourceDraftFields = () => {
    setGithubSelection([]);
    resetJiraDraftFields();
    setUploadFiles([]);
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

  // Members shown on Review, excluding the manager (rendered separately there).
  const reviewMembers = useMemo<ReviewPerson[]>(
    () =>
      users
        .filter((user) => selectedUserIds.has(user.id) && user.id !== managerId)
        .map((user) => ({
          id: user.id,
          name: getDisplayName(user),
          profileIcon: user.profileIcon,
        })),
    [users, selectedUserIds, managerId],
  );

  const memberCount = selectedUserIds.size + (managerId && !selectedUserIds.has(managerId) ? 1 : 0);

  // --- Add-source sub-flow ---

  const openAddSource = () => {
    resetSourceDraftFields();
    setAddType("GITHUB");
    setAddStep("type");
    setAddFlowKey((key) => key + 1);
    setIsAddingSource(true);
  };

  const closeAddSource = () => {
    setIsAddingSource(false);
    resetSourceDraftFields();
  };

  const handleSelectAddType = (type: SourceSystem) => {
    // A "Soon" type (not yet wired) is inert until its phase lands.
    if (!AVAILABLE_SOURCE_TYPES.includes(type)) return;

    setAddType(type);
    setAddStep("detail");
  };

  const backToTypeGrid = () => {
    setAddStep("type");
    resetSourceDraftFields();
  };

  // Inline credential creation: snapshot the current names, refetch, and let the
  // paired effect select whichever name is new.
  const handleTokenSaved = async () => {
    prevTokenNamesRef.current = effectiveTokenNames;
    setAwaitingNewToken(true);
    await loadTokenNames();
  };

  const handleCredentialSaved = async () => {
    prevCredentialNamesRef.current = jiraCredentials.map((credential) => credential.displayName);
    setAwaitingNewCredential(true);
    await reloadJiraCredentials();
  };

  const selectedJiraCredential = jiraCredentials.find(
    (credential) => credential.displayName === jiraCredentialName,
  );

  const canAddSource =
    addType === "GITHUB"
      ? githubSelection.length > 0
      : addType === "JIRA"
        ? Boolean(jiraDisplayName.trim() && jiraUrl.trim() && selectedJiraCredential)
        : addType === "UPLOAD"
          ? uploadFiles.length > 0
          : false;

  const commitAddSource = () => {
    if (!canAddSource) return;

    if (addType === "GITHUB") {
      setSources((current) =>
        githubSelection.reduce(
          (accumulated, selection) =>
            addDraftSource(accumulated, createDraftSourceFromDiscovery(selection, githubTokenName)),
          current,
        ),
      );
    } else if (addType === "JIRA" && selectedJiraCredential) {
      setSources((current) =>
        addDraftSource(
          current,
          createJiraDraft({
            displayName: jiraDisplayName.trim(),
            url: jiraUrl.trim(),
            userEmail: selectedJiraCredential.userEmail,
            tokenName: selectedJiraCredential.displayName,
          }),
        ),
      );
    } else if (addType === "UPLOAD") {
      const displayName = uploadFiles.length === 1 ? uploadFiles[0].name : "Uploaded documents";
      setSources((current) => addDraftSource(current, createUploadDraft(displayName, uploadFiles)));
    }

    closeAddSource();
  };

  // --- Commit + provisioning ---

  /** Creates the project and assigns its people. Guarded so a retry never
   * creates a second project. */
  const ensureProject = async (): Promise<string> => {
    if (createdProjectId) return createdProjectId;

    const project = await projectService.createProject({
      name: trimmedName,
      description: description.trim() || undefined,
    });

    // Members before the manager: assigning a manager also makes them a member,
    // so the reverse order would depend on the id order.
    let members = project.users;
    if (selectedUserIds.size > 0) {
      members = await projectService.assignUsersToProject(project.id, {
        userIds: [...selectedUserIds],
      });
    }

    if (managerId) {
      await projectService.setProjectManager(project.id, managerId);
    }

    setCreatedProjectId(project.id);
    // The created-project response predates both calls above, so the members are
    // folded back in before the page adds the project to its list.
    onProjectCreated({ ...project, users: members });

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
        toast.success("Project created");
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
        toast.success("Source connected");
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
    : isAddingSource
      ? addStep === "type"
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
  }, [phase, isAddingSource, addStep]);

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
    if (isAddingSource) closeAddSource();

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

    if (isAddingSource) {
      if (addStep === "type") {
        return (
          <Button
            variant="secondary"
            onClick={closeAddSource}
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
          disabled={!canAddSource}
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
        contentInsetRight={companionOpen ? COMPANION_WIDTH + COMPANION_GAP + 16 : 0}
        onClose={requestClose}
        closeLabel="Close new project wizard"
        footer={footer}
      >
        <p className="sr-only" aria-live="polite">
          {screenAnnouncement}
        </p>

        <div ref={bodyRef} tabIndex={-1} className="focus:outline-none">
          {phase === "details" && (
            <WizardDetailsStep
              name={name}
              nameError={nameError}
              description={description}
              managerId={managerId}
              managerCandidates={managerCandidates}
              isLoadingCandidates={isLoadingCandidates}
              candidatesError={candidatesError}
              onNameChange={handleNameChange}
              onNameBlur={() => setNameTouched(true)}
              onDescriptionChange={setDescription}
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
            (isAddingSource ? (
              <AddSourceFlow
                key={addFlowKey}
                step={addStep}
                selectedType={addType}
                availableTypes={AVAILABLE_SOURCE_TYPES}
                onSelectType={handleSelectAddType}
                onBack={backToTypeGrid}
                onCompanionOpenChange={setCompanionOpen}
                github={{
                  tokenNames: effectiveTokenNames,
                  tokenName: githubTokenName,
                  onTokenNameChange: setGithubTokenName,
                  onSelectionChange: setGithubSelection,
                  onTokenSaved: handleTokenSaved,
                }}
                jira={{
                  displayName: jiraDisplayName,
                  url: jiraUrl,
                  credentialName: jiraCredentialName,
                  credentials: jiraCredentials,
                  credentialsLoaded: jiraCredentialsLoaded,
                  credentialsLoading: jiraCredentialsLoading,
                  credentialsError: jiraCredentialsError,
                  defaultUserEmail: null,
                  onDisplayNameChange: setJiraDisplayName,
                  onUrlChange: setJiraUrl,
                  onCredentialNameChange: setJiraCredentialName,
                  onSubmit: commitAddSource,
                  onCredentialSaved: handleCredentialSaved,
                }}
                upload={{
                  files: uploadFiles,
                  onAddFiles: (files) => setUploadFiles((current) => [...current, ...files]),
                  onRemoveFile: (index) =>
                    setUploadFiles((current) =>
                      current.filter((_, position) => position !== index),
                    ),
                }}
              />
            ) : (
              <WizardSourcesStep
                sources={sources}
                onRemove={(sourceId) =>
                  setSources((current) => removeDraftSource(current, sourceId))
                }
                onAddSource={openAddSource}
              />
            ))}

          {phase === "review" && (
            <WizardReviewStep
              name={name}
              description={description}
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
