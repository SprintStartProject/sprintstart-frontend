import { useCallback, useMemo, useState } from "react";
import type { SegmentedTabOption } from "../../components/ui/SegmentedTabs.tsx";
import { SCHEDULED_SOURCE_SYSTEMS } from "../../features/data-ingestion/connectors/registry.ts";
import type { SourceSystem } from "../../features/data-ingestion/connectors/sourceSystems.ts";
import {
  loadProjectSyncSchedule,
  saveProjectSyncSchedule,
} from "../../features/data-ingestion/projectSyncSchedule.ts";
import type { DataSource } from "../../features/data-ingestion/types.ts";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../services/sources/syncSchedule.ts";
import { getSyncSettingsCopy } from "./ingestionRules";

type Args = {
  sources: DataSource[];
  projectId: string;
  /** Reloads what the page is built from. */
  refresh: () => Promise<unknown>;
};

/**
 * The sync-settings modal works on the selected project's sources only: it reads the schedule of
 * each of them, shows it when they all agree, and writes the chosen schedule to each of them.
 */
export function useSyncSettings({ sources, projectId, refresh }: Args) {
  const [isOpen, setIsOpen] = useState(false);
  const [system, setSystem] = useState<SourceSystem>("GITHUB");
  // Whether the sources of the open tab currently have different schedules.
  const [isMixed, setIsMixed] = useState(false);

  // The connectors whose sync policy can be edited project-wide right now: one tab per
  // schedulable connector that actually has sources on this project.
  const systems = useMemo<SegmentedTabOption<SourceSystem>[]>(() => {
    const present = new Set(sources.map((source) => source.sourceSystem));

    return SCHEDULED_SOURCE_SYSTEMS.filter((candidate) => present.has(candidate)).map(
      (candidate) => ({ value: candidate, label: getSyncSettingsCopy(candidate).label }),
    );
  }, [sources]);
  const copy = useMemo(() => getSyncSettingsCopy(system), [system]);

  const loadConfig = useCallback(async (): Promise<SyncScheduleConfig> => {
    const { config, isMixed: mixed } = await loadProjectSyncSchedule(
      system,
      sources,
      projectId || null,
    );
    setIsMixed(mixed);

    return { autoUpdate: config.autoUpdate, spec: config.schedule, nextSyncAt: null };
  }, [projectId, sources, system]);

  const save = useCallback(
    async (request: SyncScheduleRequest) => {
      await saveProjectSyncSchedule(system, sources, projectId || null, request, copy.many);
      // Deliberately does NOT reload the projects: changing sync schedules does not affect the
      // project switcher's data, and a project reload can transiently reset the selected project
      // (e.g. a slow managed-projects fetch), which blanks the page.
      await refresh();
    },
    [copy.many, projectId, refresh, sources, system],
  );

  return {
    isOpen,
    system,
    setSystem,
    systems,
    copy,
    isMixed,
    loadConfig,
    save,
    close: () => setIsOpen(false),
    open: () => {
      if (systems.length === 0) return;
      setSystem(systems[0].value);
      setIsOpen(true);
    },
  };
}
