import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Modal } from "../../../components/ui/Modal.tsx";
import { useToast } from "../../../context/useToast.ts";
import { useQueryFetch } from "../../../hooks/useQueryFetch.ts";
import { getTeamOverview } from "../../../services/teamManagementService.ts";
import { queryKeys } from "../../../services/queryKeys.ts";
import { AddSourceFlow } from "../add-source/AddSourceFlow.tsx";
import { COMPANION_GAP, COMPANION_WIDTH } from "../add-source/CredentialSlot.tsx";
import {
  addDraftSources,
  connectDraftSources,
  connectOutcomeDescription,
  hasFailedSources,
  removeDraftSource,
  setDraftSourceOwner,
  type DraftSource,
} from "../add-source/projectSourcesDraft.ts";
import { sortOwnerOptions } from "../add-source/sourceOwners.ts";
import { StagedSourceList } from "../add-source/StagedSourceList.tsx";
import { useSourceDraftForm } from "../add-source/useSourceDraftForm.ts";
import { getConnector } from "../connectors/registry.ts";

type AddSourceModalProps = {
  projectId: string | null;
  projectName?: string;
  tokenNames: string[];
  /** Whether the current user may connect sources to the selected project. */
  canIngest: boolean;
  /** Human-readable reason shown when `canIngest` is false. */
  ingestBlockedReason?: string;
  /**
   * Whether this user may name the documentation owner of a repository as they stage it.
   *
   * Narrower than {@link AddSourceModalProps.canIngest}: component ownership is written by a
   * PM/Admin-only endpoint, so HR can connect sources perfectly well and would be refused
   * here alone. Decided by the page, which already holds the profile, rather than read from
   * auth here — the modal has no other reason to know who is signed in.
   */
  canAssignOwners?: boolean;
  onClose: () => void;
  /** Called after a connect run so the page can refresh and start polling. */
  onConnected: () => void;
};

/**
 * "Add sources" modal for the Data Ingestion page.
 *
 * Like the create-project wizard's Sources step, this stages a *list* of sources
 * across the connectors (GitHub repositories, Jira instances, Confluence spaces,
 * Notion workspaces, uploaded files) and connects them together — instead of the
 * old flow, which picked one type, connected it live and closed, so only a single
 * source type could be added per opening.
 *
 * It reuses the wizard's {@link AddSourceFlow} sub-flow verbatim, so the type
 * grid, the per-connector add-source forms and the inline "add GitHub token / add
 * Atlassian credential" companions are identical in both places. The modal opens
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
  canAssignOwners: canAssignOwnersProp = false,
  onClose,
  onConnected,
}: AddSourceModalProps) {
  const toast = useToast();

  // The staged list and the screens over it: the add-source sub-flow (type grid
  // -> detail) and the terminal connecting screen. The modal opens straight on
  // the type grid — the staged list is where you land after "Add to list".
  const [sources, setSources] = useState<DraftSource[]>([]);
  const addForm = useSourceDraftForm({ initiallyOpen: true });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  // Naming an owner is part of connecting a source, so it follows `canIngest` on top of the
  // role the page has already checked.
  const canAssignOwners = canIngest && canAssignOwnersProp;

  // The project's members, which is who a repository can be handed to. Not requested at all
  // when the owner control is not going to be shown. `getTeamOverview` asks for a hard
  // `size=100`, so a project past a hundred members would quietly lose the tail of the list —
  // fine for now, and the reason to reach for a searchable picker when it stops being.
  const { data: teamUsers } = useQueryFetch(
    queryKeys.teamOverview.filtered(projectId),
    () => getTeamOverview(undefined, undefined, [projectId as string]),
    { enabled: canAssignOwners && Boolean(projectId) },
  );

  const ownerOptions = useMemo(
    () =>
      sortOwnerOptions(
        (teamUsers ?? []).map((user) => ({
          value: user.userId,
          label: `${user.firstname} ${user.lastname}`.trim() || user.userId,
        })),
      ),
    [teamUsers],
  );

  // "Add to list": stage the current form's drafts and return to the staged list
  // to keep building or connect later.
  const commitAddSource = () => {
    if (!addForm.canAdd) return;

    const drafts = addForm.commit();
    setSources((current) => addDraftSources(current, drafts));
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
    addForm.close();
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
          description: connectOutcomeDescription(connected),
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
    if (!addForm.canAdd) return;

    void runConnect(addDraftSources(sources, addForm.drafts));
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
        toast.success("Source connected", {
          description: connectOutcomeDescription(retried),
        });
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
    : addForm.isOpen
      ? addForm.step === "type"
        ? "Add a source"
        : `Add ${getConnector(addForm.type).meta.label}`
      : "Add data sources";

  const modalDescription =
    isConnecting || addForm.isOpen
      ? undefined
      : "Stage GitHub repositories, Jira instances, Confluence spaces, Notion workspaces and files, then connect them together.";

  const connectLabel =
    sources.length > 0
      ? `Connect ${sources.length} ${sources.length === 1 ? "source" : "sources"}`
      : "Connect sources";

  const footer = isConnecting ? (
    <Button variant="primary" onClick={requestClose} loading={isSubmitting} disabled={isSubmitting}>
      Done
    </Button>
  ) : addForm.isOpen ? (
    addForm.step === "type" ? (
      sources.length > 0 ? (
        <Button
          variant="secondary"
          onClick={addForm.close}
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
          disabled={!addForm.canAdd || !canIngest || !projectId}
          loading={isSubmitting}
        >
          Connect now
        </Button>

        <Button
          variant="primary"
          onClick={commitAddSource}
          disabled={!addForm.canAdd}
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
        contentInsetRight={addForm.companionOpen ? COMPANION_WIDTH + COMPANION_GAP + 16 : 0}
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
        ) : addForm.isOpen ? (
          <div className="space-y-5">
            {!canIngest && <IngestBlockedNotice reason={ingestBlockedReason} />}

            <AddSourceFlow
              key={addForm.flowKey}
              step={addForm.step}
              selectedType={addForm.type}
              onSelectType={addForm.selectType}
              onBack={addForm.backToTypes}
              isBusy={isSubmitting}
              context={{ projectId, projectName, tokenNames }}
              onDraftsChange={addForm.reportDrafts}
              onSubmit={commitAddSource}
              onCompanionOpenChange={addForm.setCompanionOpen}
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
              ownerOptions={canAssignOwners ? ownerOptions : undefined}
              onOwnerChange={
                canAssignOwners
                  ? (sourceId, ownerUserId) =>
                      setSources((current) => setDraftSourceOwner(current, sourceId, ownerUserId))
                  : undefined
              }
              emptyMessage="No sources yet. Add a GitHub repo, Jira instance, Confluence space, Notion workspace, or files to start."
            />

            <Button
              variant="secondary"
              onClick={addForm.open}
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
