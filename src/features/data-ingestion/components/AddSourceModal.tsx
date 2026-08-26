import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { useToast } from "../../../context/useToast.ts";
import {
  addDraftSource,
  connectDraftSources,
  createDraftSourceFromDiscovery,
  createJiraDraft,
  createUploadDraft,
  hasFailedSources,
  removeDraftSource,
  type DraftSource,
} from "../../admin/projectSourcesDraft.ts";
import { StagedSourceList } from "../../admin/components/StagedSourceList.tsx";
import {
  AddSourceFlow,
  COMPANION_GAP,
  COMPANION_WIDTH,
  type AddSourceStep,
} from "../../admin/components/wizard/sources/AddSourceFlow.tsx";
import { useGithubTokens } from "../../settings/hooks/useGithubTokens.ts";
import { useJiraCredentials } from "../../settings/hooks/useJiraCredentials.ts";
import { SOURCE_META, SOURCE_SYSTEMS } from "../data.ts";
import type { SourceSystem } from "../types.ts";
import type { DiscoverySelection } from "./GithubRepositoryDiscovery.tsx";
import type { JiraCredentialsDto } from "../../../services/sources/jiraService.ts";

type AddSourceModalProps = {
  projectId: string | null;
  projectName?: string;
  tokenNames: string[];
  /** Whether the current user may connect sources to the selected project. */
  canIngest: boolean;
  /** Human-readable reason shown when `canIngest` is false. */
  ingestBlockedReason?: string;
  onClose: () => void;
  /** Called after a connect run so the page can refresh and start polling. */
  onConnected: () => void;
};

/**
 * "Add sources" modal for the Data Ingestion page.
 *
 * Like the create-project wizard's Sources step, this stages a *list* of sources
 * across all three connectors (GitHub repositories, Jira instances, uploaded
 * files) and connects them together — instead of the old flow, which picked one
 * type, connected it live and closed, so only a single source type could be
 * added per opening.
 *
 * It reuses the wizard's {@link AddSourceFlow} sub-flow verbatim, so the type
 * grid, the per-connector detail forms and the inline "add GitHub token / add
 * Jira credential" companions are identical in both places. The modal opens
 * straight on that type grid; each detail screen can either stage the source
 * ("Add to list") or connect it — plus anything already staged — right away
 * ("Connect now"). Connecting runs {@link connectDraftSources} against the
 * already-existing project with live per-row status and a per-source retry, so
 * one failing source never strands the others.
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
  const toast = useToast();

  // The staged list and the screens over it: the add-source sub-flow (type grid
  // -> detail) and the terminal connecting screen. The modal opens straight on
  // the type grid — the staged list is where you land after "Add to list".
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [isAddingSource, setIsAddingSource] = useState(true);
  const [addStep, setAddStep] = useState<AddSourceStep>("type");
  const [addType, setAddType] = useState<SourceSystem>("GITHUB");
  // Remounts the GitHub picker on each add so a new "Add source" starts clean.
  const [addFlowKey, setAddFlowKey] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // True while the desktop "add credential" companion is open, so the modal
  // slides left to make room for it beside itself.
  const [companionOpen, setCompanionOpen] = useState(false);

  // GitHub detail state.
  const [githubSelection, setGithubSelection] = useState<DiscoverySelection[]>([]);
  const [githubTokenName, setGithubTokenName] = useState(tokenNames[0] ?? "");

  // The token list is owned here so an inline "add token" can refresh it and
  // auto-select the new token; it falls back to the prop until it has loaded so
  // discovery works on the first open without waiting for the refetch.
  const {
    tokenNames: loadedTokenNames,
    tokensLoaded,
    loadTokenNames,
    addTokenNameLocally,
  } = useGithubTokens();
  const effectiveTokenNames = tokensLoaded ? loadedTokenNames : tokenNames;

  // Jira detail state.
  const [jiraDisplayName, setJiraDisplayName] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");
  const [jiraCredentialName, setJiraCredentialName] = useState("");

  // Upload detail state — files staged in memory until the list is connected.
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const isJiraDetail = isAddingSource && addStep === "detail" && addType === "JIRA";
  const {
    credentials: jiraCredentials,
    loaded: jiraCredentialsLoaded,
    error: jiraCredentialsError,
    isRefreshing: jiraCredentialsLoading,
    reload: reloadJiraCredentials,
    addCredentialLocally,
  } = useJiraCredentials(isJiraDetail);

  // Adopt the first token as soon as the list arrives (and heal a stale
  // selection) so discovery is usable on the first open.
  useEffect(() => {
    if (effectiveTokenNames.length === 0) return;

    void Promise.resolve().then(() => {
      setGithubTokenName((current) =>
        current && effectiveTokenNames.includes(current) ? current : effectiveTokenNames[0],
      );
    });
  }, [effectiveTokenNames]);

  // Adopt the first stored Jira credential once the list arrives, keeping a
  // still-valid choice.
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

  const resetSourceDraftFields = () => {
    setGithubSelection([]);
    setJiraDisplayName("");
    setJiraUrl("");
    setJiraCredentialName("");
    setUploadFiles([]);
  };

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
    setAddType(type);
    setAddStep("detail");
  };

  const backToTypeGrid = () => {
    setAddStep("type");
    resetSourceDraftFields();
  };

  // Inline credential creation: adopt the new token/credential locally and
  // select it right away, so a successful add is reflected even if the reload
  // fails or is aborted; the reload then reconciles with the server.
  const handleTokenSaved = async (tokenName: string) => {
    addTokenNameLocally(tokenName);
    setGithubTokenName(tokenName);
    await loadTokenNames();
  };

  const handleCredentialSaved = async (credential: JiraCredentialsDto) => {
    addCredentialLocally(credential);
    setJiraCredentialName(credential.displayName);
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

  /**
   * The draft(s) captured on the current detail screen — several at once for the
   * GitHub multi-select, one for Jira/Upload. Empty when the detail isn't
   * complete enough to stage.
   */
  const buildDetailDrafts = (): DraftSource[] => {
    if (!canAddSource) return [];

    if (addType === "GITHUB") {
      return githubSelection.map((selection) =>
        createDraftSourceFromDiscovery(selection, githubTokenName),
      );
    }

    if (addType === "JIRA" && selectedJiraCredential) {
      return [
        createJiraDraft({
          displayName: jiraDisplayName.trim(),
          url: jiraUrl.trim(),
          userEmail: selectedJiraCredential.userEmail,
          tokenName: selectedJiraCredential.displayName,
        }),
      ];
    }

    if (addType === "UPLOAD") {
      const displayName = uploadFiles.length === 1 ? uploadFiles[0].name : "Uploaded documents";
      return [createUploadDraft(displayName, uploadFiles)];
    }

    return [];
  };

  /** Appends drafts to a list, skipping any that are already staged. */
  const mergeDrafts = (base: DraftSource[], added: DraftSource[]): DraftSource[] =>
    added.reduce((accumulated, draft) => addDraftSource(accumulated, draft), base);

  // "Add to list": stage the current detail and return to the staged list to
  // keep building or connect later.
  const commitAddSource = () => {
    const drafts = buildDetailDrafts();
    if (drafts.length === 0) return;

    setSources((current) => mergeDrafts(current, drafts));
    closeAddSource();
  };

  // --- Connect + retry ---

  /**
   * Connects a list of staged sources against the existing project with live
   * per-row status; shared by the list screen's "Connect" and the detail
   * screen's "Connect now".
   */
  const runConnect = async (list: DraftSource[]) => {
    if (!projectId || !canIngest || list.length === 0 || isSubmitting) return;

    // Show the list being connected (including a just-captured "Connect now"
    // draft) before the first per-row status lands.
    setSources(list);
    setIsAddingSource(false);
    setIsConnecting(true);
    setIsSubmitting(true);

    try {
      const connected = await connectDraftSources(projectId, list, setSources);

      // Refresh the page (and start its polling window) regardless of partial
      // failures so the sources that did connect show up right away.
      onConnected();

      if (hasFailedSources(connected)) {
        toast.warning("Some sources couldn't be connected", {
          description: "Retry the failed ones, or close and try again.",
        });
      } else {
        toast.success("Sources connected", {
          description: "Initial ingestion is running in the background.",
        });
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // "Connect now": stage the current detail and connect the whole list right
  // away, skipping the intermediate list screen.
  const handleConnectNow = () => {
    const drafts = buildDetailDrafts();
    if (drafts.length === 0) return;

    void runConnect(mergeDrafts(sources, drafts));
  };

  const handleConnectAll = () => {
    void runConnect(sources);
  };

  const retrySource = async (sourceId: string) => {
    const source = sources.find((current) => current.id === sourceId);
    if (!source || !projectId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const retried = await connectDraftSources(projectId, [source], (progressSources) =>
        setSources((current) =>
          current.map(
            (currentSource) =>
              progressSources.find((progress) => progress.id === currentSource.id) ?? currentSource,
          ),
        ),
      );

      onConnected();

      if (hasFailedSources(retried)) {
        toast.error("Couldn't connect the source.");
      } else {
        toast.success("Source connected");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Close handling ---

  // Every dismissal path routes through here so a list with unconnected staged
  // sources asks before discarding them. Nothing is discarded once connecting
  // has started (those sources are already connected or attempted).
  const requestClose = () => {
    if (isSubmitting) return;

    if (!isConnecting && sources.length > 0) {
      setConfirmingClose(true);
      return;
    }

    onClose();
  };

  // --- Rendering ---

  const modalTitle = isConnecting
    ? "Connecting sources"
    : isAddingSource
      ? addStep === "type"
        ? "Add a source"
        : `Add ${SOURCE_META[addType].type}`
      : "Add data sources";

  const modalDescription =
    isConnecting || isAddingSource
      ? undefined
      : "Stage GitHub repositories, Jira instances and files, then connect them together.";

  const connectLabel =
    sources.length > 0
      ? `Connect ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
      : "Connect sources";

  const footer = isConnecting ? (
    <Button variant="primary" onClick={requestClose} loading={isSubmitting} disabled={isSubmitting}>
      Done
    </Button>
  ) : isAddingSource ? (
    addStep === "type" ? (
      sources.length > 0 ? (
        <Button
          variant="secondary"
          onClick={() => setIsAddingSource(false)}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="sm:mr-auto"
        >
          Back to source list
        </Button>
      ) : (
        <Button variant="secondary" onClick={requestClose} className="sm:mr-auto">
          Cancel
        </Button>
      )
    ) : (
      // The detail screen's "back to types" lives in AddSourceFlow's own header
      // (master-detail); the footer offers staging the source or connecting it
      // (plus any already staged) straight away.
      <>
        <Button
          variant="secondary"
          onClick={handleConnectNow}
          disabled={!canAddSource || !canIngest || !projectId}
          loading={isSubmitting}
        >
          Connect now
        </Button>

        <Button
          variant="primary"
          onClick={commitAddSource}
          disabled={!canAddSource}
          icon={<Plus className="h-4 w-4" />}
        >
          Add to list
        </Button>
      </>
    )
  ) : (
    <>
      <Button variant="secondary" onClick={requestClose} className="sm:mr-auto">
        Cancel
      </Button>

      <Button
        variant="primary"
        onClick={handleConnectAll}
        disabled={sources.length === 0 || !canIngest || !projectId}
        loading={isSubmitting}
      >
        {connectLabel}
      </Button>
    </>
  );

  return (
    <>
      <Modal
        isOpen
        title={modalTitle}
        description={
          modalDescription ? (
            <p className="text-sm leading-relaxed text-app-text-muted">{modalDescription}</p>
          ) : undefined
        }
        size="xl"
        isDismissDisabled={isSubmitting}
        contentInsetRight={companionOpen ? COMPANION_WIDTH + COMPANION_GAP + 16 : 0}
        onClose={requestClose}
        closeLabel="Close add source"
        bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
        footer={footer}
      >
        {isConnecting ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-app-text-muted">
              Connecting {sources.length} {sources.length === 1 ? "source" : "sources"}. Each
              one&rsquo;s ingestion then continues in the background.
            </p>

            <StagedSourceList
              sources={sources}
              disabled={isSubmitting}
              onRetry={(sourceId) => void retrySource(sourceId)}
            />
          </div>
        ) : isAddingSource ? (
          <div className="space-y-5">
            {!canIngest && <IngestBlockedNotice reason={ingestBlockedReason} />}

            <AddSourceFlow
              key={addFlowKey}
              step={addStep}
              selectedType={addType}
              availableTypes={SOURCE_SYSTEMS}
              onSelectType={handleSelectAddType}
              onBack={backToTypeGrid}
              isBusy={isSubmitting}
              onCompanionOpenChange={setCompanionOpen}
              github={{
                tokenNames: effectiveTokenNames,
                tokenName: githubTokenName,
                onTokenNameChange: setGithubTokenName,
                onSelectionChange: setGithubSelection,
                onTokenSaved: handleTokenSaved,
                projectId,
                projectName,
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
                  setUploadFiles((current) => current.filter((_, position) => position !== index)),
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {!canIngest && <IngestBlockedNotice reason={ingestBlockedReason} />}

            <div>
              <p className="text-sm font-medium text-app-text">Data sources</p>
              <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
                Sources are ingested in the background once you connect them.
              </p>
            </div>

            <StagedSourceList
              sources={sources}
              disabled={isSubmitting}
              onRemove={(sourceId) => setSources((current) => removeDraftSource(current, sourceId))}
              emptyMessage="No sources yet. Add a GitHub repo, Jira instance, or files to start."
            />

            <Button
              variant="secondary"
              onClick={openAddSource}
              icon={<Plus className="h-4 w-4" />}
              className="w-full"
            >
              Add source
            </Button>
          </div>
        )}
      </Modal>

      <AlertDialog
        isOpen={confirmingClose}
        title="Discard staged sources?"
        description="These sources haven't been connected yet. Closing now discards the list you've built."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onClose={() => setConfirmingClose(false)}
        onConfirm={() => {
          setConfirmingClose(false);
          onClose();
        }}
      />
    </>
  );
}

/** Warning banner shown when the user may not connect sources to the project. */
function IngestBlockedNotice({ reason }: { reason?: string }) {
  return (
    <div className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
      {reason ?? "You can only connect sources to projects you manage."}
    </div>
  );
}
