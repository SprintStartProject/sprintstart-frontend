import {
  ArrowUp,
  CalendarClock,
  Clock3,
  Database,
  RefreshCw,
  Unlink,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { useToast } from "../../../context/useToast";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { AlertDialog } from "../../../components/ui/AlertDialog.tsx";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle.tsx";
import { DrawerCard } from "../../admin/components/DrawerCard.tsx";
import { getConnector } from "../connectors/registry.ts";
import { deriveConnectionStatus, deriveSyncStatus, formatDateTime, formatNumber } from "../data.ts";
import { useManualSync } from "../hooks/useManualSync.ts";
import type { DataSource, LoadingState, SourceChange } from "../types.ts";
import { InfoRow } from "./InfoRows.tsx";
import { SyncScheduleSettings } from "./SyncScheduleSettings.tsx";
import { SourceStatusChip } from "./SourceStatusChip.tsx";
import { SourceTypeBadge } from "./SourceTypeBadge.tsx";
import { DinoGame } from "../../chatbot/components/DinoGame.tsx";
import { useDinoUnlocked, useSpaceOpensDino } from "../../easter-eggs/hooks/useDinoWaitingGame.ts";

type SourceDetailsPanelProps = {
  source: DataSource;
  /** The selected project, which the source's actions act within. */
  projectId: string | null;
  /** Whether the viewer may switch the source on and off and edit its sync schedule (PM or admin). */
  canManage?: boolean;
  /**
   * Whether the viewer may remove the source from the project. Gates the
   * "Remove from project" action.
   */
  canUnlink?: boolean;
  /**
   * Called after the panel changed something about the source, so the page can
   * reload what its cards are built from. `unlinked` is followed by the page
   * closing this drawer.
   */
  onChanged: (change: SourceChange) => Promise<void>;
  onClose: () => void;
};

/**
 * Slide-out panel showing the ingestion details of one source. The panel is the
 * same for every connector: what differs (the identity card, which actions exist,
 * the wording) comes from the source's connector definition.
 */
export function SourceDetailsPanel({
  source,
  projectId,
  canManage = false,
  canUnlink = false,
  onChanged,
  onClose,
}: SourceDetailsPanelProps) {
  const [updateState, setUpdateState] = useState<LoadingState>("idle");
  const [refreshState, setRefreshState] = useState<LoadingState>("idle");
  const [enabledState, setEnabledState] = useState<LoadingState>("idle");
  const [unlinkState, setUnlinkState] = useState<LoadingState>("idle");
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const toast = useToast();
  const syncManually = useManualSync(projectId);
  const definition = getConnector(source.sourceSystem);
  const { meta, actions, DetailsSection } = definition;
  const context = useMemo(() => ({ projectId }), [projectId]);
  const Icon = meta.icon;
  const isUpdating = updateState === "loading";
  const isRefreshing = refreshState === "loading";
  const isSyncing = source.statusView.state === "syncing" || isUpdating;
  const syncFailed = source.statusView.state === "attention";
  const dinoUnlocked = useDinoUnlocked();
  const [dinoActive, closeDino] = useSpaceOpensDino(isSyncing, dinoUnlocked, {
    keepActiveUntilExit: true,
  });

  // A source system without an update action (uploads have no upstream to
  // re-ingest from) gets no button at all; the others have one, which is enabled
  // once the source's identity is known. A synchronous sync reports its outcome
  // itself; an update that runs in the background only starts.
  const updateAction = actions.manualSync ?? actions.update;
  const canUpdate = updateAction?.isAvailable(source) ?? false;
  const reportsUpdateItself = actions.manualSync !== undefined;
  const updateLabel = `Update ${meta.noun.singular}`;

  const schedule = actions.schedule;
  const canEditSchedule = canManage && schedule?.isAvailable(source) === true;
  const setEnabled = actions.setEnabled;
  const canToggleEnabled = canManage && setEnabled?.isAvailable(source) === true;
  // A disabled source is exactly the one the status endpoint collapses to DISABLED.
  const isEnabled = source.backendStatus !== "DISABLED";
  const isTogglingEnabled = enabledState === "loading";
  const unlink = actions.unlink;
  const canUnlinkSource = canUnlink && unlink?.isAvailable(source) === true;
  const isUnlinking = unlinkState === "loading";
  const removableNoun = meta.noun.singular;
  const removalHint = unlink?.removalHint ?? "";
  const resourceSyncTimes = definition.resourceSyncTimes(source.details);
  const hasResourceSyncTimes = resourceSyncTimes.some(({ value }) => value !== null);

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!setEnabled) return;

    setEnabledState("loading");

    try {
      await setEnabled.run(source, enabled, context);
      await onChanged("changed");
      setEnabledState("success");
      toast.success(enabled ? "Source enabled" : "Source disabled", {
        description: enabled ? "Included in ingestion again." : "Excluded from ingestion.",
      });
    } catch (error) {
      setEnabledState("error");
      toast.error(error instanceof Error ? error.message : "Couldn't update the source.");
    }
  };

  const handleUpdateSource = async () => {
    if (!canUpdate) return;

    setUpdateState("loading");

    try {
      if (actions.manualSync) {
        await syncManually(source);
      } else if (actions.update) {
        await actions.update.run(source, context);
        toast.success("Update started", {
          description: "Details refresh while ingestion runs.",
        });
      }

      await onChanged("updated");
      setUpdateState("success");
    } catch (error) {
      setUpdateState("error");
      if (!reportsUpdateItself) {
        toast.error(error instanceof Error ? error.message : "Couldn't start the update.");
      }
    }
  };

  const handleConfirmUnlink = async () => {
    if (!unlink) return;

    setUnlinkState("loading");

    try {
      await unlink.run(source, context);
      await onChanged("unlinked");
      // The page closes this drawer on success, so there is nothing to reset
      // here — the component unmounts; the confirming toast lives at the root.
      toast.success("Removed from project");
    } catch (error) {
      setUnlinkState("error");
      toast.error(
        error instanceof Error ? error.message : "Couldn't remove the source from the project.",
      );
    }
  };

  const handleRefreshDetails = async () => {
    setRefreshState("loading");

    try {
      await onChanged("changed");
      setRefreshState("success");
      toast.success("Source details refreshed");
    } catch (error) {
      setRefreshState("error");
      toast.error(error instanceof Error ? error.message : "Couldn't refresh the source details.");
    }
  };

  const details = useMemo(() => {
    const artifactCount = source.totalArtifactCount ?? source.artifacts;
    const hasSourceArtifactTimestamp = artifactCount > 0 && source.lastRunAt;
    const lastSync = hasSourceArtifactTimestamp
      ? formatDateTime(source.lastRunAt)
      : source.sharesSourceSystem
        ? "Not available"
        : source.lastSync;

    return {
      artifactCount,
      lastSync,
      latestUpdatedCount: source.latestUpdatedCount,
      errors: source.errors,
    };
  }, [source]);

  // The row inside the connector's identity card: a switch for managers, plain
  // text for everyone else.
  const enabledRow: ReactNode = canToggleEnabled ? (
    <div className="flex items-center gap-3 border-t border-app-border py-2.5">
      <dt className="w-24 shrink-0 text-[12.5px] text-app-text-muted">Source</dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-app-text">
          Include in ingestion
          <span className="ml-1 font-normal text-app-text-subtle">
            · sync this {meta.noun.singular} into the knowledge base
          </span>
        </span>
        <AccountEnabledToggle
          enabled={isEnabled}
          disabled={isTogglingEnabled}
          ariaLabel={`Toggle ingestion for ${source.name}`}
          onChange={(next) => {
            void handleToggleEnabled(next);
          }}
        />
      </dd>
    </div>
  ) : (
    <InfoRow label="Source" value={isEnabled ? "Enabled" : "Disabled"} />
  );

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      title={source.name}
      closeAriaLabel="Close source details"
      zIndexClassName="z-50"
      showOverlay
      leading={
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-text-muted">
          <Icon className="h-6 w-6" />
        </div>
      }
      badge={
        <>
          <SourceTypeBadge type={source.type} />
          {/* Two badges, identical for every connector: whether the source is
              connected/enabled, and its live sync status (spinner while syncing). */}
          <SourceStatusChip status={deriveConnectionStatus(source)} />
          <SourceStatusChip status={deriveSyncStatus(source)} />
        </>
      }
      footer={
        <div className={`grid w-full gap-3 ${updateAction ? "grid-cols-2" : "grid-cols-1"}`}>
          {updateAction && (
            <Button
              variant="primary"
              onClick={() => {
                void handleUpdateSource();
              }}
              disabled={!canUpdate || isRefreshing}
              loading={isUpdating}
              icon={<Icon className="h-4 w-4" />}
              title={canUpdate ? undefined : updateAction.unavailableReason}
            >
              {updateLabel}
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => {
              void handleRefreshDetails();
            }}
            disabled={isUpdating}
            loading={isRefreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh details
          </Button>
        </div>
      }
    >
      <DrawerCard label="Ingestion" icon={Database} index={0}>
        {isSyncing && (
          <div className="mb-3 rounded-xl border border-app-brand-border bg-app-brand-soft px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-app-brand-text">
                {/* The sentence beside it already says what is happening, so the
                    glyph stays silent rather than announcing a second time. */}
                <Spinner size="sm" silent />
                {source.statusView.label === "Indexing"
                  ? "Indexing artifacts into the knowledge base…"
                  : "Syncing the latest changes…"}
              </p>
              {dinoUnlocked && !dinoActive && (
                <span className="hidden items-center gap-1 text-xs font-normal text-app-brand-text/80 sm:inline-flex">
                  Press{" "}
                  <kbd className="rounded border border-app-brand-border bg-app-surface px-1.5 py-0.5 font-mono text-[10px] shadow-2xs">
                    Space
                  </kbd>{" "}
                  to pass the time 🦖
                </span>
              )}
            </div>
          </div>
        )}

        {dinoActive && (
          <div className="mb-3">
            <DinoGame
              onExit={closeDino}
              // The badge may only claim the state the source actually reached,
              // and only once nothing is in flight: an update request still
              // pending (isUpdating) counts as syncing even while the status
              // reads "connected". A failed run (attention) is reported as
              // such; a disabled or stale source announces nothing.
              replyReady={
                dinoActive && !isSyncing && (source.statusView.state === "connected" || syncFailed)
              }
              completionLabel={syncFailed ? "Sync failed" : "Sync complete"}
              completionTone={syncFailed ? "danger" : "success"}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="Artifacts" icon={Database}>
            {formatNumber(details.artifactCount)}
          </Tile>
          <Tile label="Last sync" icon={Clock3}>
            {details.lastSync}
          </Tile>
          <Tile label="Updated" icon={ArrowUp}>
            {formatNumber(details.latestUpdatedCount)}
          </Tile>
          <Tile label="Failed" icon={XCircle} warn={details.errors > 0}>
            {formatNumber(details.errors)}
          </Tile>
        </div>
      </DrawerCard>

      {DetailsSection && <DetailsSection source={source} enabledRow={enabledRow} />}

      {hasResourceSyncTimes && (
        <DrawerCard label="Last Synced" icon={Clock3} index={2} className="mt-4 sm:mt-5">
          <dl className="-my-1">
            {resourceSyncTimes.map(({ label, value }) => (
              <InfoRow key={label} label={label} value={formatDateTime(value)} />
            ))}
          </dl>
        </DrawerCard>
      )}

      {canEditSchedule && schedule && (
        <DrawerCard label="Sync Schedule" icon={CalendarClock} index={3} className="mt-4 sm:mt-5">
          <SyncScheduleSettings
            loadKey={source.sourceId}
            loadConfig={() => schedule.load(source, context)}
            onSave={async (request) => {
              await schedule.save(source, request, context);
              await onChanged("changed");
            }}
            autoUpdateOnText={`Due checks update this ${meta.noun.singular}.`}
            autoUpdateOffText={`Due checks only mark this ${meta.noun.singular} out of date.`}
            toggleAriaLabel={`Toggle ${meta.noun.singular} auto update`}
          />
        </DrawerCard>
      )}

      {source.failedItems.length > 0 && (
        <DrawerCard label="Failed Items" icon={XCircle} index={4} className="mt-4 sm:mt-5">
          <div className="space-y-3">
            {source.failedItems.map((item) => (
              <div
                key={`${item.artifactIdentifier}-${item.reason}`}
                className="rounded-xl border border-app-warning-border bg-app-warning-bg px-4 py-3"
              >
                <p className="text-sm font-medium wrap-break-word text-app-warning-text">
                  {item.artifactIdentifier}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">{item.reason}</p>
              </div>
            ))}
          </div>
        </DrawerCard>
      )}

      {canUnlinkSource && (
        <DrawerCard
          label="Project link"
          icon={Unlink}
          index={5}
          variant="danger"
          className="mt-4 sm:mt-5"
        >
          <p className="text-sm text-app-danger-text">
            Remove this {removableNoun} from the current project. {removalHint}
          </p>
          <Button
            variant="dangerSoft"
            onClick={() => setIsUnlinkDialogOpen(true)}
            loading={isUnlinking}
            icon={<Unlink className="h-4 w-4" />}
            className="mt-4"
          >
            Remove from project
          </Button>
        </DrawerCard>
      )}

      <AlertDialog
        isOpen={isUnlinkDialogOpen}
        title={`Remove ${removableNoun} from project?`}
        description={`"${source.name}" will no longer feed this project's knowledge base. ${removalHint}`}
        confirmLabel="Remove"
        loadingLabel="Removing…"
        variant="danger"
        isLoading={isUnlinking}
        onClose={() => {
          if (isUnlinking) return;
          setIsUnlinkDialogOpen(false);
        }}
        onConfirm={() => {
          void handleConfirmUnlink();
        }}
      />
    </DetailsSideDrawer>
  );
}

function Tile({
  label,
  icon: Icon,
  warn = false,
  children,
}: {
  label: string;
  icon: LucideIcon;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface-muted px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-app-text-subtle">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={`mt-1.5 text-lg font-bold break-words tabular-nums ${
          warn ? "text-app-danger-text" : "text-app-text"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
