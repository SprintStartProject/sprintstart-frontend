import { useCallback, useEffect, useId, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Stepper } from "../../../components/ui/Stepper";
import { ApiError } from "../../../services/apiClient";
import {
  projectService,
  type AdminProjectDetails,
  type ProjectManager,
} from "../../../services/projectService";
import { connectJiraInstance } from "../../../services/sources/jiraService";
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
import { JiraConnectStep } from "../../data-ingestion/components/JiraConnectStep";
import { SourceTypeStep } from "../../data-ingestion/components/SourceTypeStep";
import { SOURCE_SYSTEMS } from "../../data-ingestion/data";
import type { SourceSystem } from "../../data-ingestion/types";
import { useJiraCredentials } from "../../settings/hooks/useJiraCredentials";
import { UploadArtifactPanel } from "../../knowledge-base/components/UploadArtifactPanel";
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
 * The project is created no earlier than the type-specific "connect" action, so
 * cancelling out of the wizard before then leaves nothing behind. Which action
 * that is depends on the connector: GitHub stages the selected repositories and
 * connects them on finish; Jira creates the project and connects the instance in
 * one step; Upload has to attach files to a live project, so it creates the
 * project explicitly first and then reveals the drop zone. Because creation and
 * connecting are separate backend calls, a source failure cannot roll the
 * project back — the wizard therefore stays open on a partial failure and offers
 * a retry rather than pretending the whole operation failed.
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
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

  const [managerCandidates, setManagerCandidates] = useState<ProjectManager[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState("");

  // Source type chosen on step 2. All three connectors are now wired: GitHub
  // stages repositories, Jira connects an instance, Upload attaches files.
  const [selectedType, setSelectedType] = useState<SourceSystem>("GITHUB");
  // The resolved multi-select from the GitHub discovery picker, staged until the
  // project is created and the repositories are connected against it.
  const [selection, setSelection] = useState<DiscoverySelection[]>([]);
  const [tokenName, setTokenName] = useState(tokenNames[0] ?? "");

  // --- Jira connect form ---
  const [jiraDisplayName, setJiraDisplayName] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraCredentialName, setJiraCredentialName] = useState("");

  const [sources, setSources] = useState<DraftSource[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Locks Back/Cancel while an upload batch is in flight.
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Set once the project exists, so a retry after a partial failure connects
  // the remaining sources instead of creating a second project.
  const [createdProjectId, setCreatedProjectId] = useState("");

  const isGithub = selectedType === "GITHUB";
  const isJira = selectedType === "JIRA";
  const isUpload = selectedType === "UPLOAD";

  const {
    credentials: jiraCredentials,
    loaded: jiraCredentialsLoaded,
    error: jiraCredentialsError,
    isRefreshing: jiraCredentialsLoading,
  } = useJiraCredentials(isOpen && isJira);

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
    setStep("details");
    setSourceStep("type");
    setName("");
    setDescription("");
    setManagerId("");
    setSelectedUserIds(new Set());
    setSelectedType("GITHUB");
    setSelection([]);
    setJiraDisplayName("");
    setJiraUrl("");
    setJiraCredentialName("");
    setSources([]);
    setSubmitError("");
    setCreatedProjectId("");
  };

  // Switching type clears the state that belongs to the previous connector so
  // the footer count and each step stay consistent with the current choice.
  const handleSelectType = (type: SourceSystem) => {
    setSelectedType(type);
    setSubmitError("");
    if (type !== "GITHUB") setSelection([]);
  };

  const closeWizard = () => {
    if (isSubmitting || isUploadingFiles) return;

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
        toConnect = selection.map((item) => createDraftSourceFromDiscovery(item, tokenName));
        setSources(toConnect);
      }

      const projectId = await ensureProject();

      if (toConnect.length === 0) {
        resetWizard();
        onClose();
        return;
      }

      const connectedSources = await connectDraftSources(projectId, toConnect, setSources);

      if (hasFailedSources(connectedSources)) {
        // The project is already saved; keep the wizard open so the failed
        // repositories can be retried or dropped without losing the list.
        setSubmitError("The project was created, but some repositories could not be connected.");
        return;
      }

      resetWizard();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Project could not be created.");
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
                progressSources.find((progressSource) => progressSource.id === currentSource.id) ??
                currentSource,
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
  const isTypeStep = step === "sources" && !isProjectCreated && sourceStep === "type";
  const isDetailStep = step === "sources" && !isProjectCreated && sourceStep === "detail";

  // Details → people → source type → repositories. The post-create staged list
  // stays on the last step, which is where the repositories were being
  // connected.
  const stepIndex = isDetailsStep ? 0 : isPeopleStep ? 1 : isTypeStep ? 2 : 3;
  const isBusy = isSubmitting || isUploadingFiles;
  /**
   * Creates the project and connects one Jira instance to it. The connect
   * endpoint returns 202 with an empty body (progress surfaces through the
   * ingestion-run history), so on success we just close. If the project was
   * created but the connect failed, `createdProjectId` keeps the wizard on a
   * retry that reuses the same project instead of creating another.
   */
  const finishJira = async () => {
    if (!isNameValid) return;

    const displayName = jiraDisplayName.trim();
    const url = jiraUrl.trim();
    const credentialName = jiraCredentialName.trim();

    if (!displayName) {
      setSubmitError("Enter a display name for the Jira instance.");
      return;
    }

    if (!url) {
      setSubmitError("Enter the Jira instance URL (e.g. https://your-domain.atlassian.net).");
      return;
    }

    if (!credentialName) {
      setSubmitError("Select a stored Jira credential.");
      return;
    }

    const selectedCredential = jiraCredentials.find(
      (credential) => credential.displayName === credentialName,
    );
    if (!selectedCredential) {
      setSubmitError("The selected Jira credential is no longer available.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const projectId = await ensureProject();

      await connectJiraInstance({
        displayName,
        url,
        userEmail: selectedCredential.userEmail,
        tokenName: selectedCredential.displayName,
        projectId,
      });

      resetWizard();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSubmitError(
          "The Jira instance or credential could not be found. Check the URL and the selected credential.",
        );
      } else if (error instanceof ApiError && error.status === 502) {
        setSubmitError(
          "The Jira server could not be reached. Check the instance URL and try again.",
        );
      } else {
        setSubmitError(
          error instanceof Error ? error.message : "The Jira instance could not be connected.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Creates the project so files can be attached to it. Uploads go to a live
   * project id, so unlike the staged connectors the project must exist before
   * the drop zone is usable.
   */
  const createProjectForUpload = async () => {
    if (!isNameValid) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await ensureProject();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Project could not be created.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="New Project"
      description={
        <Stepper steps={["Details", "People", "Source type", "Connect"]} current={stepIndex} />
      }
      size="xl"
      isDismissDisabled={isBusy}
      onClose={closeWizard}
      closeLabel="Close new project wizard"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={
              isDetailsStep
                ? closeWizard
                : isProjectCreated
                  ? closeWizard
                  : isDetailStep
                    ? () => {
                        setSubmitError("");
                        setSourceStep("type");
                      }
                    : isPeopleStep
                      ? () => setStep("details")
                      : () => setStep("people")
            }
            disabled={isBusy}
            icon={isDetailsStep || isProjectCreated ? undefined : <ArrowLeft className="h-4 w-4" />}
          >
            {isDetailsStep ? "Cancel" : isProjectCreated ? "Done" : "Back"}
          </Button>

          {isTypeStep && (
            // Lets the user create the project straight away, choosing to attach
            // sources later from its Data Ingestion page instead of now.
            <Button variant="secondary" onClick={() => void finish()} loading={isSubmitting}>
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
          ) : isJira ? (
            <Button
              variant="primary"
              onClick={() => void finishJira()}
              loading={isSubmitting}
              icon={<Check className="h-4 w-4" />}
            >
              {isProjectCreated ? "Retry Jira connection" : "Create and connect Jira instance"}
            </Button>
          ) : isUpload ? (
            !isProjectCreated ? (
              <Button
                variant="primary"
                onClick={() => void createProjectForUpload()}
                loading={isSubmitting}
                icon={<Check className="h-4 w-4" />}
              >
                Create project
              </Button>
            ) : null
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
          <Field label="Name" controlId={nameInputId}>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field label="Description" controlId={descriptionInputId}>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minRows={4}
              maxRows={12}
            />
          </Field>
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
          <Field label="Project manager" controlId={managerSelectId}>
            <Select
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
              disabled={isLoadingCandidates || managerCandidates.length === 0}
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
            </Select>

            {candidatesError && (
              <p className="flex items-start gap-2 text-sm text-app-danger-text">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{candidatesError}</span>
              </p>
            )}

            <p className="text-xs text-app-text-muted">
              The manager becomes a member automatically, so they do not have to be ticked below.
            </p>
          </Field>

          <MemberPicker
            users={users}
            selectedUserIds={selectedUserIds}
            disabled={isSubmitting}
            label="Members"
            onToggleUser={(userId) =>
              setSelectedUserIds((current) => toggleSelectedUserId(current, userId))
            }
            onToggleVisible={(visibleUsers, allSelected) =>
              setSelectedUserIds((current) =>
                toggleVisibleUserSelection(current, visibleUsers, allSelected),
              )
            }
          />
        </form>
      ) : isProjectCreated && isGithub ? (
        // The project exists (e.g. after a partial failure): show the connect
        // outcome per repository with retry/remove instead of the picker.
        <StagedSourceList
          sources={sources}
          disabled={isSubmitting}
          onRemove={(sourceId) => setSources((current) => removeDraftSource(current, sourceId))}
          onRetry={(sourceId) => void retrySource(sourceId)}
        />
      ) : isTypeStep ? (
        <SourceTypeStep
          selectedType={selectedType}
          onSelectType={handleSelectType}
          heading="Start data ingestion"
          description="Connect a data source to this project now, or skip for now and add sources later from its Data Ingestion page."
          availableTypes={SOURCE_SYSTEMS}
        />
      ) : isGithub ? (
        isProjectCreated ? (
          // The project exists (e.g. after a partial failure): show the connect
          // outcome per repository with retry/remove instead of the picker.
          <StagedSourceList
            sources={sources}
            disabled={isSubmitting}
            onRemove={(sourceId) => setSources((current) => removeDraftSource(current, sourceId))}
            onRetry={(sourceId) => void retrySource(sourceId)}
          />
        ) : (
          <GithubRepositoryDiscovery
            tokenNames={tokenNames}
            projectId={null}
            tokenName={tokenName}
            onTokenNameChange={setTokenName}
            onSelectionChange={setSelection}
            isConnecting={isSubmitting}
          />
        )
      ) : isJira ? (
        <JiraConnectStep
          displayName={jiraDisplayName}
          url={jiraUrl}
          credentialName={jiraCredentialName}
          credentials={jiraCredentials}
          credentialsLoaded={jiraCredentialsLoaded}
          credentialsLoading={jiraCredentialsLoading}
          credentialsError={jiraCredentialsError}
          isBusy={isSubmitting}
          canIngest
          errorMessage={null}
          onDisplayNameChange={setJiraDisplayName}
          onUrlChange={setJiraUrl}
          onCredentialNameChange={setJiraCredentialName}
          onSubmit={() => void finishJira()}
        />
      ) : createdProjectId ? (
        <UploadArtifactPanel
          projectId={createdProjectId}
          onUploadSuccess={() => {}}
          onFinished={closeWizard}
          onUploadingChange={setIsUploadingFiles}
        />
      ) : (
        <div className="rounded-2xl border border-app-border bg-app-surface-muted px-4 py-4 text-sm leading-relaxed text-app-text-muted">
          Uploaded files attach to the project, so the project is created first. Choose{" "}
          <span className="font-medium text-app-text">Create project</span> to add files now — you
          can connect more sources afterwards from its Data Ingestion page.
        </div>
      )}
    </Modal>
  );
}
