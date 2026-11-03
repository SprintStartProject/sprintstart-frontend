import { PanelPresence } from "../../components/ui/PanelPresence.tsx";
import { RunDetailsPanel } from "../../features/data-ingestion/components/RunDetailsPanel.tsx";
import { SourceDetailsPanel } from "../../features/data-ingestion/components/SourceDetailsPanel.tsx";
import { getRunSourceLabel } from "../../features/data-ingestion/data.ts";
import { WarningBanner } from "../../features/data-ingestion/components/WarningBanner.tsx";
import type { DataIngestionPageModel } from "./useDataIngestionPage";

/** The panels of the open source and the open run, sliding in over the page. */
export function IngestionPanels({ model }: { model: DataIngestionPageModel }) {
  const { selection, runSelection, feed, actions, can, project } = model;

  return (
    <>
      <PanelPresence value={selection.selectedSource}>
        {(source) => (
          <SourceDetailsPanel
            source={source}
            projectId={project.selectedProjectId || null}
            canManage={can.canManageSyncSettings}
            canUnlink={can.canIngestIntoSelectedProject}
            onChanged={actions.onSourceChanged}
            onClose={selection.close}
          />
        )}
      </PanelPresence>

      <PanelPresence value={runSelection.selectedRun}>
        {(run) => (
          <RunDetailsPanel
            run={run}
            sourceLabel={getRunSourceLabel(run, feed.runSourceLabels)}
            onClose={runSelection.close}
          />
        )}
      </PanelPresence>
    </>
  );
}

/** What went wrong loading the runs, the status rows or the project's sources. */
export function IngestionBanners({ model }: { model: DataIngestionPageModel }) {
  const { data } = model.feed;

  return (
    <>
      {data.runsErrorMessage && <WarningBanner>{data.runsErrorMessage}</WarningBanner>}
      {data.statusErrorMessage && <WarningBanner>{data.statusErrorMessage}</WarningBanner>}
      {data.projectSourcesErrorMessage && (
        <WarningBanner>{data.projectSourcesErrorMessage}</WarningBanner>
      )}
    </>
  );
}
