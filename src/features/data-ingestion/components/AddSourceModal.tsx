import { AlertTriangle, ArrowLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { Stepper } from "../../../components/ui/Stepper.tsx";
import { useToast } from "../../../context/useToast.ts";
import { ApiError } from "../../../services/apiClient.ts";
import {
  addRepositoryToProject,
  connectGithubRepository,
  connectRepositories,
} from "../../../services/sources/githubService.ts";
import { parseGithubRepositoryInput } from "../../../services/sources/githubRepositoryInput.ts";
import { connectJiraInstance } from "../../../services/sources/jiraService.ts";
import { useJiraCredentials } from "../../settings/hooks/useJiraCredentials.ts";
import { UploadArtifactPanel } from "../../knowledge-base/components/UploadArtifactPanel.tsx";
import { SOURCE_META, SOURCE_SYSTEMS } from "../data.ts";
import type { SourceSystem } from "../types.ts";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "./GithubRepositoryDiscovery.tsx";
import { JiraConnectStep } from "./JiraConnectStep.tsx";
import { SourceTypeStep } from "./SourceTypeStep.tsx";

type AddSourceModalProps = {
  projectId: string | null;
  projectName?: string;
  tokenNames: string[];
  /** Whether the current user may connect sources to the selected project. */
  canIngest: boolean;
  /** Human-readable reason shown when `canIngest` is false. */
  ingestBlockedReason?: string;
  onClose: () => void;
  /** Called after a successful batch connect so the page can refresh. */
  onConnected: () => void;
};

type WizardStep = "type" | "detail";

/**
 * Two-step "Add sources" wizard. Step one picks the source type (GitHub, Jira,
 * Upload); step two shows the type-specific flow — GitHub opens the org/user
 * repository discovery (searchable, paginated, multi-select, with a single-repo
 * fallback), Jira enters one instance directly (no discovery endpoint) and picks
 * a stored credential, and Upload adds documents. This keeps the familiar
 * source-type choice while giving each connector its own connect path.
 */
export function AddSourceModal({
  projectId,
  projectName,
  tokenNames,
  canIngest,
  ingestBlockedReason,
  onClose,
  onConnected,
}: AddSourceModalProps) {
  const [step, setStep] = useState<WizardStep>("type");
  const [selectedType, setSelectedType] = useState<SourceSystem>("GITHUB");
  // Within the GitHub step: browse an org/user, or add one known repository.
  const [githubMode, setGithubMode] = useState<"discover" | "single">("discover");
  const [singleOwner, setSingleOwner] = useState("");
  const [singleName, setSingleName] = useState("");
  // Locks Back/Cancel while an upload batch is in flight.
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const [tokenName, setTokenName] = useState(tokenNames[0] ?? "");

  // The parent loads the saved token names asynchronously *after* opening the
  // modal, so on the very first open `tokenNames` is empty and `tokenName`
  // initialises to "" — which made discovery reject with "choose a token" until
  // the modal was closed and reopened. Adopt the first token as soon as the list
  // arrives (and heal a selection that is no longer available), instead of only
  // reading the prop once at mount.
  useEffect(() => {
    if (tokenNames.length === 0) return;

    // Deferred to a microtask so the state update does not run synchronously in
    // the effect body and cascade a render (the pattern used across the app).
    void Promise.resolve().then(() => {
      setTokenName((current) =>
        current && tokenNames.includes(current) ? current : tokenNames[0],
      );
    });
  }, [tokenNames]);

  // Resolved multi-select from the discovery picker.
  const [selection, setSelection] = useState<DiscoverySelection[]>([]);

  const [connectState, setConnectState] = useState<"idle" | "loading" | "error">("idle");
  // `connectError` holds only the inline, pre-submit validation shown at the
  // step (no project, bad input, missing token); the connect request's own
  // failure is surfaced as an error toast instead.
  const [connectError, setConnectError] = useState<string | null>(null);
  const toast = useToast();

  const isGithub = selectedType === "GITHUB";
  const isJira = selectedType === "JIRA";
  const selectedCount = selection.length;

  // --- Jira connect state ---
  const [jiraDisplayName, setJiraDisplayName] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraCredentialName, setJiraCredentialName] = useState("");

  const {
    credentials: jiraCredentials,
    loaded: jiraCredentialsLoaded,
    error: jiraCredentialsError,
    isRefreshing: jiraCredentialsLoading,
  } = useJiraCredentials(isJira);

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

  const handleConnect = async () => {
    if (!projectId) {
      setConnectState("error");
      setConnectError("Select a project before connecting repositories.");
      return;
    }

    if (!canIngest) {
      setConnectState("error");
      setConnectError(
        ingestBlockedReason ?? "You can only connect sources to projects you manage.",
      );
      return;
    }

    if (selection.length === 0) {
      setConnectState("error");
      setConnectError("Select at least one repository to connect.");
      return;
    }

    setConnectState("loading");
    setConnectError(null);

    // Repos already ingested elsewhere are linked to this project (reusing their
    // artifacts); only genuinely new ones go through fetch + ingestion.
    const toLink = selection.filter((repository) => repository.linkState === "linkable");
    const toIngest = selection.filter((repository) => repository.linkState !== "linkable");

    try {
      for (const repository of toLink) {
        if (!repository.repositoryId) continue;

        await addRepositoryToProject(repository.repositoryId, projectId);
      }

      if (toIngest.length > 0) {
        await connectRepositories(
          toIngest.map((repository) => ({
            owner: repository.owner,
            name: repository.name,
          })),
          tokenName.trim(),
          projectId,
        );
      }

      setConnectState("idle");
      toast.success("Sources connected", {
        description: "Initial ingestion is running in the background.",
      });
      onConnected();
      onClose();
    } catch (error) {
      setConnectState("idle");
      toast.error(
        error instanceof Error ? error.message : "Couldn't connect the selected repositories.",
      );
    }
  };

  const isSingleRepo = isGithub && githubMode === "single";
  const isUpload = selectedType === "UPLOAD";

  /**
   * Connects one known repository. Kept inside this modal so the single-repo
   * path shares the wizard's chrome, project guardrails and token picker instead
   * of dropping the user into a separate, differently-shaped dialog.
   */
  const handleConnectSingle = async () => {
    if (!projectId) {
      setConnectState("error");
      setConnectError("Select a project before connecting a repository.");
      return;
    }

    if (!canIngest) {
      setConnectState("error");
      setConnectError(
        ingestBlockedReason ?? "You can only connect sources to projects you manage.",
      );
      return;
    }

    const parsed = parseGithubRepositoryInput(singleOwner, singleName);

    if (!parsed) {
      setConnectState("error");
      setConnectError(
        "Enter the repository as owner/name, a GitHub URL, or fill in owner and repository name.",
      );
      return;
    }

    if (!tokenName.trim()) {
      setConnectState("error");
      setConnectError("Choose a stored GitHub access token.");
      return;
    }

    setConnectState("loading");
    setConnectError(null);

    try {
      await connectGithubRepository({
        ...parsed,
        tokenName: tokenName.trim(),
        projectId,
      });

      setConnectState("idle");
      toast.success("Repository connected", {
        description: "Initial ingestion is running in the background.",
      });
      onConnected();
      onClose();
    } catch (error) {
      setConnectState("idle");
      toast.error(error instanceof Error ? error.message : "Couldn't connect the repository.");
    }
  };

  /**
   * Connects one Jira instance. The connect endpoint returns 202 with an empty
   * body (no transaction id) — progress surfaces through the ingestion-run
   * history — so on success we just fire `onConnected` (starts polling) and
   * close. 404/502 get their own messages (missing instance/credential vs.
   * Jira unreachable).
   */
  const handleConnectJira = async () => {
    if (!projectId) {
      setConnectState("error");
      setConnectError("Select a project before connecting a Jira instance.");
      return;
    }

    if (!canIngest) {
      setConnectState("error");
      setConnectError(
        ingestBlockedReason ?? "You can only connect sources to projects you manage.",
      );
      return;
    }

    const displayName = jiraDisplayName.trim();
    const url = jiraUrl.trim();
    const tokenName = jiraCredentialName.trim();

    if (!displayName) {
      setConnectState("error");
      setConnectError("Enter a display name for the Jira instance.");
      return;
    }

    if (!url) {
      setConnectState("error");
      setConnectError("Enter the Jira instance URL (e.g. https://your-domain.atlassian.net).");
      return;
    }

    if (!tokenName) {
      setConnectState("error");
      setConnectError("Select a stored Jira credential.");
      return;
    }

    const selectedCredential = jiraCredentials.find(
      (credential) => credential.displayName === tokenName,
    );
    if (!selectedCredential) {
      setConnectState("error");
      setConnectError("The selected Jira credential is no longer available.");
      return;
    }
    setConnectState("loading");
    setConnectError(null);

    try {
      await connectJiraInstance({
        displayName,
        url,
        userEmail: selectedCredential.userEmail,
        tokenName: selectedCredential.displayName,
        projectId,
      });

      setConnectState("idle");
      toast.success("Jira instance connected", {
        description: "Initial ingestion is running in the background.",
      });
      onConnected();
      onClose();
    } catch (error) {
      setConnectState("idle");

      if (error instanceof ApiError && error.status === 404) {
        toast.error(
          "The Jira instance or credential could not be found. Check the URL and the selected credential.",
        );
      } else if (error instanceof ApiError && error.status === 502) {
        toast.error("The Jira server could not be reached. Check the instance URL and try again.");
      } else {
        toast.error(error instanceof Error ? error.message : "Couldn't connect the Jira instance.");
      }
    }
  };

  const modalTitle =
    step === "type"
      ? "Add a data source"
      : isSingleRepo
        ? "Add a single repository"
        : isGithub
          ? "Discover GitHub repositories"
          : isUpload
            ? "Upload Files"
            : `Connect ${SOURCE_META[selectedType].type}`;

  return (
    <Modal
      isOpen
      title={modalTitle}
      description={<Stepper steps={["Source type", "Connect"]} current={step === "type" ? 0 : 1} />}
      size="xl"
      isDismissDisabled={connectState === "loading" || isUploadingFiles}
      onClose={onClose}
      closeLabel="Close add source"
      bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
      headerActions={
        step === "detail" && isGithub ? (
          <button
            type="button"
            onClick={() => {
              setConnectError(null);
              setSelection([]);
              setGithubMode(isSingleRepo ? "discover" : "single");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text transition hover:border-app-brand-border hover:bg-app-surface-hover"
          >
            {isSingleRepo ? (
              <>
                <Search className="h-3.5 w-3.5" />
                Discover repositories
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Add single repo
              </>
            )}
          </button>
        ) : undefined
      }
      footer={
        step === "type" ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover"
            >
              Cancel
            </button>

            <Button
              variant="primary"
              onClick={() => setStep("detail")}
              trailingIcon={<ChevronRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep("type")}
              disabled={connectState === "loading" || isUploadingFiles}
              className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={connectState === "loading" || isUploadingFiles}
              className="rounded-xl border border-app-border bg-app-surface px-4 py-3 text-sm font-semibold text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            {isSingleRepo && (
              <Button
                variant="primary"
                onClick={() => void handleConnectSingle()}
                disabled={!canIngest}
                loading={connectState === "loading"}
              >
                {connectState === "loading" ? "Connecting…" : "Connect repository"}
              </Button>
            )}

            {isGithub && !isSingleRepo && (
              <Button
                variant="primary"
                onClick={() => void handleConnect()}
                disabled={selectedCount === 0 || !canIngest}
                loading={connectState === "loading"}
              >
                {connectState === "loading"
                  ? "Connecting…"
                  : `Connect ${selectedCount > 0 ? selectedCount : ""} selected`.replace(
                      /\s+/g,
                      " ",
                    )}
              </Button>
            )}

            {isJira && (
              <Button
                variant="primary"
                onClick={() => void handleConnectJira()}
                disabled={!canIngest}
                loading={connectState === "loading"}
              >
                {connectState === "loading" ? "Connecting…" : "Connect Jira instance"}
              </Button>
            )}
          </>
        )
      }
    >
      {step === "type" ? (
        <SourceTypeStep
          selectedType={selectedType}
          onSelectType={setSelectedType}
          availableTypes={SOURCE_SYSTEMS}
        />
      ) : isUpload ? (
        projectId ? (
          <UploadArtifactPanel
            projectId={projectId}
            onUploadSuccess={() => {
              toast.success("Files uploaded", {
                description: "Initial ingestion is running in the background.",
              });
              onConnected();
            }}
            onFinished={onClose}
            onUploadingChange={setIsUploadingFiles}
          />
        ) : (
          <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
            Select a project before uploading files.
          </div>
        )
      ) : isSingleRepo ? (
        <SingleRepositoryStep
          owner={singleOwner}
          repositoryName={singleName}
          tokenName={tokenName}
          tokenNames={tokenNames}
          isBusy={connectState === "loading"}
          canIngest={canIngest}
          ingestBlockedReason={ingestBlockedReason}
          errorMessage={connectError}
          onOwnerChange={setSingleOwner}
          onRepositoryNameChange={setSingleName}
          onTokenNameChange={setTokenName}
          onSubmit={() => void handleConnectSingle()}
        />
      ) : isGithub ? (
        <div className="space-y-5">
          {!canIngest && (
            <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
              {ingestBlockedReason ?? "You can only connect sources to projects you manage."}
            </div>
          )}

          <GithubRepositoryDiscovery
            tokenNames={tokenNames}
            projectId={projectId}
            projectName={projectName}
            tokenName={tokenName}
            onTokenNameChange={setTokenName}
            onSelectionChange={setSelection}
            isConnecting={connectState === "loading"}
            connectError={connectError}
          />
        </div>
      ) : (
        <JiraConnectStep
          displayName={jiraDisplayName}
          url={jiraUrl}
          credentialName={jiraCredentialName}
          credentials={jiraCredentials}
          credentialsLoaded={jiraCredentialsLoaded}
          credentialsLoading={jiraCredentialsLoading}
          credentialsError={jiraCredentialsError}
          isBusy={connectState === "loading"}
          canIngest={canIngest}
          ingestBlockedReason={ingestBlockedReason}
          errorMessage={connectError}
          onDisplayNameChange={setJiraDisplayName}
          onUrlChange={setJiraUrl}
          onCredentialNameChange={setJiraCredentialName}
          onSubmit={() => void handleConnectJira()}
        />
      )}
    </Modal>
  );
}

/**
 * Single-repository variant of the GitHub step. Mirrors the discovery step's
 * layout and controls (same field styling, same token picker, same guardrails)
 * so switching between the two feels like one flow rather than two dialogs.
 */
function SingleRepositoryStep({
  owner,
  repositoryName,
  tokenName,
  tokenNames,
  isBusy,
  canIngest,
  ingestBlockedReason,
  errorMessage,
  onOwnerChange,
  onRepositoryNameChange,
  onTokenNameChange,
  onSubmit,
}: {
  owner: string;
  repositoryName: string;
  tokenName: string;
  tokenNames: string[];
  isBusy: boolean;
  canIngest: boolean;
  ingestBlockedReason?: string;
  errorMessage: string | null;
  onOwnerChange: (value: string) => void;
  onRepositoryNameChange: (value: string) => void;
  onTokenNameChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const hasTokens = tokenNames.length > 0;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {!canIngest && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          {ingestBlockedReason ?? "You can only connect sources to projects you manage."}
        </div>
      )}

      {!hasTokens && (
        <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          Add a GitHub personal access token in Settings first, then come back to connect a
          repository.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="single-repo-owner" className="text-sm font-medium text-app-text">
            Repository owner
          </label>
          <Input
            id="single-repo-owner"
            value={owner}
            onChange={(event) => onOwnerChange(event.target.value)}
            disabled={isBusy || !hasTokens}
            placeholder="octocat or octocat/hello-world"
            className="mt-2"
          />
        </div>

        <div>
          <label htmlFor="single-repo-name" className="text-sm font-medium text-app-text">
            Repository name
          </label>
          <Input
            id="single-repo-name"
            value={repositoryName}
            onChange={(event) => onRepositoryNameChange(event.target.value)}
            disabled={isBusy || !hasTokens}
            placeholder="hello-world"
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="single-repo-token" className="text-sm font-medium text-app-text">
          Access token
        </label>
        <Select
          id="single-repo-token"
          value={tokenName}
          onChange={(event) => onTokenNameChange(event.target.value)}
          disabled={isBusy || !hasTokens}
          className="mt-2"
        >
          {hasTokens ? (
            tokenNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          ) : (
            <option value="">No saved tokens</option>
          )}
        </Select>
      </div>

      <p className="text-xs text-app-text-subtle">
        Paste a full GitHub URL or <code>owner/name</code> into the owner field and the repository
        name is filled in for you.
      </p>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </form>
  );
}
