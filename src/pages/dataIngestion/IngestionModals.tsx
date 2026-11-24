import { Modal } from "../../components/ui/Modal.tsx";
import { SegmentedTabs } from "../../components/ui/SegmentedTabs.tsx";
import { AddSourceModal } from "../../features/data-ingestion/components/AddSourceModal.tsx";
import { SyncScheduleSettings } from "../../features/data-ingestion/components/SyncScheduleSettings.tsx";
import { WarningBanner } from "../../features/data-ingestion/components/WarningBanner.tsx";
import { ConnectorList } from "../../features/connectors/components/ConnectorList.tsx";
import { ConnectorsLoadingState } from "../../features/connectors/components/ConnectorsLoadingState.tsx";
import type { DataIngestionPageModel } from "./useDataIngestionPage";

export function ConnectorsModal({ model }: { model: DataIngestionPageModel }) {
  const { connectorsModal, feed, project } = model;
  const { query, connectors } = feed.connectors;

  return (
    <Modal
      isOpen={connectorsModal.isOpen}
      title="Connectors"
      description="Enable or disable a connector, and choose which sources are in scope for this project."
      size="xl"
      bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
      onClose={connectorsModal.close}
    >
      {query.isError && (
        <div className="mb-4">
          <WarningBanner compact>
            {query.error instanceof Error ? query.error.message : "Failed to load connectors"}
          </WarningBanner>
        </div>
      )}

      {query.isLoading ? (
        <ConnectorsLoadingState />
      ) : (
        <ConnectorList
          connectors={connectors}
          togglingConnectorId={connectorsModal.togglingId}
          projectId={project.selectedProjectId}
          onToggleEnabled={(connector) => {
            void connectorsModal.toggle(connector);
          }}
          onSourcesSaved={() => void feed.refresh()}
        />
      )}
    </Modal>
  );
}

export function SyncSettingsModal({ model }: { model: DataIngestionPageModel }) {
  const { syncSettings: sync } = model;
  const { copy } = sync;

  return (
    <Modal
      isOpen={sync.isOpen}
      title={`${copy.label} Sync Settings`}
      description={`Apply one sync policy to all ${copy.many} in this project.`}
      size="lg"
      bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
      onClose={sync.close}
    >
      {sync.systems.length > 1 ? (
        <div className="mb-5">
          <SegmentedTabs
            value={sync.system}
            options={sync.systems}
            onChange={sync.setSystem}
            layoutId="sync-settings-provider-pill"
            ariaLabel="Sync settings connector"
          />
        </div>
      ) : null}

      <SyncScheduleSettings
        key={sync.system}
        loadKey={sync.system}
        loadConfig={sync.loadConfig}
        onSave={sync.save}
        showNextSync={false}
        disclaimer={`Applying these settings overwrites the sync settings of every ${copy.one} in this project.${
          sync.isMixed ? " These sources currently have different schedules." : ""
        }`}
        autoUpdateOnText={`Due checks update all ${copy.many} in this project.`}
        autoUpdateOffText={
          copy.skipsWhenAutoUpdateOff
            ? `Due checks skip ${copy.many} in this project. They only update when started manually.`
            : `Due checks only mark ${copy.many} in this project out of date.`
        }
        toggleAriaLabel={`Toggle ${copy.label} auto update for this project`}
        saveLabel="Apply to project"
      />
    </Modal>
  );
}

export function AddSourceDialog({ model }: { model: DataIngestionPageModel }) {
  const { actions, project, can } = model;
  const { selectedProject, selectedProjectId } = project;

  if (!actions.isAddSourceOpen) return null;

  return (
    <AddSourceModal
      projectId={selectedProjectId}
      projectName={selectedProject?.name}
      tokenNames={actions.githubTokenNames}
      canIngest={Boolean(selectedProjectId) && can.canIngestIntoSelectedProject}
      canAssignOwners={can.canAssignComponentOwners}
      ingestBlockedReason={
        !selectedProjectId
          ? "Select a project before connecting sources."
          : !can.canIngestIntoSelectedProject
            ? `You can only connect sources to projects you manage. You are a member of "${selectedProject?.name ?? "this project"}" but not its project manager.`
            : undefined
      }
      onClose={actions.closeAddSource}
      onConnected={actions.onConnected}
    />
  );
}
