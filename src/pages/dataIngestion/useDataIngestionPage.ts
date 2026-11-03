import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useProjectContext } from "../../features/projects/useProjectContext.ts";
import type { SectionKey } from "../../features/data-ingestion/types.ts";
import { useConnectorsModal } from "./useConnectors";
import { useIngestionActions } from "./useIngestionActions";
import { useIngestionFeed, useRunSelection } from "./useIngestionFeed";
import { useProjectDeepLink } from "./useProjectDeepLink";
import { useSourceSelection } from "./useSourceSelection";
import { useSyncSettings } from "./useSyncSettings";

/** Who may do what on this page. */
function usePermissions() {
  const { profile } = useAuth();
  const { selectedProject } = useProjectContext();
  const isAdminOrPm = profile?.permissionGroup === "ADMIN" || profile?.permissionGroup === "PM";

  return {
    // Sync settings, and naming the documentation owner of a repository (which writes component
    // ownership, and that endpoint is PM/Admin only): the same two roles, but each for its own
    // reason -- kept apart so changing one does not quietly change the other.
    canManageSyncSettings: isAdminOrPm,
    canAssignComponentOwners: isAdminOrPm,
    // The `/github/connect` endpoint only checks the global PM/ADMIN role, so the backend accepts
    // an ingest into a project the PM is merely a member of and then fails deep in the pipeline
    // with a 500. Mirror the product rule up front instead: only the assigned project manager
    // (or an admin) may connect a source to a project.
    canIngestIntoSelectedProject:
      profile?.permissionGroup === "ADMIN" || (selectedProject?.isManaged ?? false),
  };
}

/** Everything the data ingestion page reads and does, a hook per concern. */
export function useDataIngestionPage() {
  const project = useProjectContext();
  useProjectDeepLink(project.selectedProjectId, project.setSelectedProjectId);
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const feed = useIngestionFeed(project.selectedProjectId);
  const selection = useSourceSelection(feed.sources, setActiveSection);
  const actions = useIngestionActions({
    feed,
    selection,
    showSection: setActiveSection,
    reloadProjects: project.reloadProjects,
  });

  return {
    project,
    activeSection,
    setActiveSection,
    feed,
    selection,
    actions,
    can: usePermissions(),
    runSelection: useRunSelection(feed.data.runs),
    connectorsModal: useConnectorsModal(feed.connectors),
    syncSettings: useSyncSettings({
      sources: feed.sources,
      projectId: project.selectedProjectId,
      refresh: feed.refresh,
    }),
  };
}

export type DataIngestionPageModel = ReturnType<typeof useDataIngestionPage>;
