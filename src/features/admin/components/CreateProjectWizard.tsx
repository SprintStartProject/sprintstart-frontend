import { useCallback, useEffect, useId, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Stepper } from "../../../components/ui/Stepper";
import {
  projectService,
  type AdminProjectDetails,
  type ProjectManager,
} from "../../../services/projectService";
import {
  connectDraftSources,
  createDraftSourceFromDiscovery,
  hasFailedSources,
  removeDraftSource,
  type DraftSource,
} from "../projectSourcesDraft";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../data-ingestion/components/GithubRepositoryDiscovery";
import {
  ComingSoonStep,
  SourceTypeStep,
} from "../../data-ingestion/components/SourceTypeStep";
import type { SourceSystem } from "../../data-ingestion/types";
import { MemberPicker } from "./MemberPicker";
import { StagedSourceList } from "./StagedSourceList";
import { toggleSelectedUserId, toggleVisibleUserSelection } from "../data";
import type { AdminUser } from "../types";

type CreateProjectWizardProps = {
  isOpen: boolean;
  tokenNames: string[];
  /**
   * The user directory, already loaded by the admin page. Passed in rather than
   * fetched here so opening the wizard does not repeat a request the page has
   * made anyway.
   */
  users: AdminUser[];
  onClose: () => void;
  /** Fired once the project exists, before any source finished connecting. */
  onProjectCreated: (project: AdminProjectDetails) => void;
};

type WizardStep = "details" | "people" | "sources";
// Within the sources step, the source-type choice and the type-specific detail
// are shown one after another (like the Data Ingestion "Add source" flow).
type SourceStep = "type" | "detail";

/**
 * Three-step flow for creating a project: its metadata, who works on it, and
 * optionally the sources to attach.
 *
 * People get a step of their own rather than sitting under the metadata fields:
 * picking a manager and ticking members off a list is a different kind of work
 * than typing a name, and putting both on one screen made the first step long
 * enough to scroll.
 *
 * The project is created when the wizard finishes, not when a step is left, so
 * cancelling out later leaves nothing behind. Sources are connected one by
 * one afterwards against the new project id; because creation and connecting
 * are separate backend calls, a source failure cannot roll the project back —
 * the wizard therefore stays open on a partial failure and offers a retry
 * rather than pretending the whole operation failed.
 */
export function CreateProjectWizard({
  isOpen,
  tokenNames,
  users,
  onClose,
  onProjectCreated,
}: CreateProjectWizardProps) {
  const nameInputId = useId();
  const descriptionInputId = useId();
  const managerSelectId = useId();

  const [step, setStep] = useState<WizardStep>("details");
  const [sourceStep, setSourceStep] = useState<SourceStep>("type");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [managerCandidates, setManagerCandidates] = useState<ProjectManager[]>(
    [],
  );
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState("");

  // Source type chosen on step 2. Only GitHub can be connected during creation;
  // Jira is coming soon and uploads need the project to already exist.
  const [selectedType, setSelectedType] = useState<SourceSystem>("GITHUB");
  // The resolved multi-select from the GitHub discovery picker, staged until the
  // project is created and the repositories are connected against it.
  const [selection, setSelection] = useState<DiscoverySelection[]>([]);
  const [tokenName, setTokenName] = useState(tokenNames[0] ?? "");

  const [sources, setSources] = useState<DraftSource[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Set once the project exists, so a retry after a partial failure connects
  // the remaining sources instead of creating a second project.
  const [createdProjectId, setCreatedProjectId] = useState("");

  // The token list arrives asynchronously; adopt the first token as soon as it
  // does (and heal a stale selection) so discovery is usable on the first open.
  useEffect(() => {
    if (tokenNames.length === 0) return;

    void Promise.resolve().then(() => {
      setTokenName((current) =>
        current && tokenNames.includes(current) ? current : tokenNames[0],
      );
    });
  }, [tokenNames]);

  const loadManagerCandidates = useCallback(async () => {
    setIsLoadingCandidates(true);
    setCandidatesError("");

    try {
      setManagerCandidates(await projectService.getManagerCandidates());
    } catch (error) {
      setCandidatesError(
        error instanceof Error
          ? error.message
          : "Manager candidates could not be loaded.",
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
    setStep("details");
    setSourceStep("type");
    setName("");
    setDescription("");
    setManagerId("");
    setSelectedUserIds(new Set());
    setSelectedType("GITHUB");
    setSelection([]);
    setSources([]);
    setSubmitError("");
    setCreatedProjectId("");
  };

  // Only GitHub stages a selection; leaving it clears the staged repositories so
  // the footer count and "coming soon" panels stay consistent.
  const handleSelectType = (type: SourceSystem) => {
    setSelectedType(type);
    if (type !== "GITHUB") setSelection([]);
  };

  const closeWizard = () => {
    if (isSubmitting) return;

    resetWizard();
    onClose();
  };

  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;
  const selectedCount = selection.length;
  const hasFailures = hasFailedSources(sources);

  const goToPeople = () => {
    if (!isNameValid) return;

    setSubmitError("");
    setStep("people");
  };

  const goToSources = () => {
    if (!isNameValid) return;

    setSubmitError("");
    setSourceStep("type");
    setStep("sources");
  };

  /** Creates the project unless a previous attempt already did. */
  const ensureProject = async (): Promise<string> => {
    if (createdProjectId) return createdProjectId;

    const project = await projectService.createProject({
      name: trimmedName,
      description: description.trim() || undefined,
    });

    // Members before the manager, mirroring `applyPeopleChanges`: assigning a
    // manager also makes them a member, so doing it the other way round would
    // depend on the order the ids happen to be in.
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
    // The created-project response predates both calls above, so the members
    // are folded back in before the page adds the project to its list.
    onProjectCreated({ ...project, users: members });

    return project.id;
  };

  const finish = async () => {
    if (!isNameValid) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      // Materialize the staged drafts from the discovery selection on the first
      // attempt; a retry reuses `sources`, which already carries per-repo status.
      let toConnect = sources;
      if (sources.length === 0 && selection.length > 0) {
        toConnect = selection.map((item) =>
          createDraftSourceFromDiscovery(item, tokenName),
        );
        setSources(toConnect);
      }

      const projectId = await ensureProject();

      if (toConnect.length === 0) {
        resetWizard();
        onClose();
        return;
      }

      const connectedSources = await connectDraftSources(
        projectId,
        toConnect,
        setSources,
      );

      if (hasFailedSources(connectedSources)) {
        // The project is already saved; keep the wizard open so the failed
        // repositories can be retried or dropped without losing the list.
        setSubmitError(
          "The project was created, but some repositories could not be connected.",
        );
        return;
      }

      resetWizard();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Project could not be created.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const retrySource = async (sourceId: string) => {
    const source = sources.find((current) => current.id === sourceId);
    if (!source || !createdProjectId) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const retriedSources = await connectDraftSources(
        createdProjectId,
        [source],
        (progressSources) =>
          setSources((current) =>
            current.map(
              (currentSource) =>
                progressSources.find(
                  (progressSource) => progressSource.id === currentSource.id,
                ) ?? currentSource,
            ),
          ),
      );

      if (hasFailedSources(retriedSources)) {
        setSubmitError("The repository could not be connected.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDetailsStep = step === "details";
  const isPeopleStep = step === "people";
  // Once the project exists there is nothing left to cancel and going back
  // would misrepresent the details as still editable, so the secondary button
  // turns into a plain way out.
  const isProjectCreated = Boolean(createdProjectId);
  // The two halves of the sources step, shown only before the project exists.
  const isTypeStep =
    step === "sources" && !isProjectCreated && sourceStep === "type";
  const isDetailStep =
    step === "sources" && !isProjectCreated && sourceStep === "detail";

  // Details → people → source type → repositories. The post-create staged list
  // stays on the last step, which is where the repositories were being
  // connected.
  const stepIndex = isDetailsStep ? 0 : isPeopleStep ? 1 : isTypeStep ? 2 : 3;

  return (
    <Modal
      isOpen={isOpen}
      title="New Project"
      description={
        <Stepper
          steps={["Details", "People", "Source type", "Connect"]}
          current={stepIndex}
        />
      }
      size="xl"
      isDismissDisabled={isSubmitting}
      onClose={closeWizard}
      closeLabel="Close new project wizard"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={
              isDetailsStep || isProjectCreated
                ? closeWizard
                : isDetailStep
                  ? () => setSourceStep("type")
                  : isPeopleStep
                    ? () => setStep("details")
                    : () => setStep("people")
            }
            disabled={isSubmitting}
            icon={
              isDetailsStep || isProjectCreated ? undefined : (
                <ArrowLeft className="h-4 w-4" />
              )
            }
          >
            {isDetailsStep ? "Cancel" : isProjectCreated ? "Done" : "Back"}
          </Button>

          {isTypeStep && (
            // Lets the user create the project straight away, choosing to attach
            // sources later from its Data Ingestion page instead of now.
            <Button
              variant="secondary"
              onClick={() => void finish()}
              loading={isSubmitting}
            >
              Skip for now
            </Button>
          )}

          {isDetailsStep || isPeopleStep || isTypeStep ? (
            <Button
              variant="primary"
              onClick={
                isDetailsStep
                  ? goToPeople
                  : isPeopleStep
                    ? goToSources
                    : () => setSourceStep("detail")
              }
              disabled={(isDetailsStep && !isNameValid) || isSubmitting}
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          ) : !isProjectCreated || hasFailures ? (
            <Button
              variant="primary"
              onClick={() => void finish()}
              loading={isSubmitting}
              icon={<Check className="h-4 w-4" />}
            >
              {isProjectCreated
                ? "Retry failed sources"
                : selectedCount === 0
                  ? "Create without sources"
                  : `Create and connect ${selectedCount} ${
                      selectedCount === 1 ? "repository" : "repositories"
                    }`}
            </Button>
          ) : null}
        </>
      }
    >
      {submitError && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {isDetailsStep ? (
        <form
          id="create-project-details-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            goToPeople();
          }}
        >
          <div>
            <label
              htmlFor={nameInputId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              Name
            </label>
            <input
              id={nameInputId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-medium text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
            />
          </div>

          <div>
            <label
              htmlFor={descriptionInputId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              Description
            </label>
            <textarea
              id={descriptionInputId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="min-h-28 w-full resize-y rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm font-medium leading-relaxed text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
            />
          </div>

        </form>
      ) : isPeopleStep ? (
        <form
          id="create-project-people-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            goToSources();
          }}
        >
          <div>
            <label
              htmlFor={managerSelectId}
              className="mb-1.5 block text-sm text-app-text-muted"
            >
              Project manager
            </label>
            <select
              id={managerSelectId}
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
              disabled={isLoadingCandidates || managerCandidates.length === 0}
              className="h-11 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm text-app-text outline-none transition-colors focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {isLoadingCandidates
                  ? "Loading candidates..."
                  : managerCandidates.length === 0
                    ? "No candidates available"
                    : "No manager"}
              </option>
              {managerCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.firstName || candidate.lastName
                    ? `${candidate.firstName} ${candidate.lastName}`.trim()
                    : candidate.username}
                </option>
              ))}
            </select>

            {candidatesError && (
              <p className="mt-2 flex items-start gap-2 text-sm text-app-danger-text">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{candidatesError}</span>
              </p>
            )}

            <p className="mt-2 text-xs text-app-text-muted">
              The manager becomes a member automatically, so they do not have to
              be ticked below.
            </p>
          </div>

          <MemberPicker
            users={users}
            selectedUserIds={selectedUserIds}
            disabled={isSubmitting}
            label="Members"
            onToggleUser={(userId) =>
              setSelectedUserIds((current) =>
                toggleSelectedUserId(current, userId),
              )
            }
            onToggleVisible={(visibleUsers, allSelected) =>
              setSelectedUserIds((current) =>
                toggleVisibleUserSelection(current, visibleUsers, allSelected),
              )
            }
          />
        </form>
      ) : isProjectCreated ? (
        // The project exists (e.g. after a partial failure): show the connect
        // outcome per repository with retry/remove instead of the picker.
        <StagedSourceList
          sources={sources}
          disabled={isSubmitting}
          onRemove={(sourceId) =>
            setSources((current) => removeDraftSource(current, sourceId))
          }
          onRetry={(sourceId) => void retrySource(sourceId)}
        />
      ) : isTypeStep ? (
        <SourceTypeStep
          selectedType={selectedType}
          onSelectType={handleSelectType}
          heading="Start data ingestion"
          description="Connect a data source to this project now, or skip for now and add sources later from its Data Ingestion page."
        />
      ) : selectedType === "GITHUB" ? (
        <GithubRepositoryDiscovery
          tokenNames={tokenNames}
          projectId={null}
          tokenName={tokenName}
          onTokenNameChange={setTokenName}
          onSelectionChange={setSelection}
          isConnecting={isSubmitting}
        />
      ) : selectedType === "JIRA" ? (
        <ComingSoonStep sourceSystem="JIRA" />
      ) : (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          Files can be uploaded once the project exists. Create the project
          first, then add uploads from its Data Ingestion page.
        </div>
      )}
    </Modal>
  );
}
