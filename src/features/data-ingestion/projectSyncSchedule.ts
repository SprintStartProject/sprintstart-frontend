import {
  configureGithubRepository,
  getGithubRepositoryConfig,
  type ConfigureGithubRepositoryRequest,
  type GithubScheduleSpec,
} from "../../services/sources/githubService.ts";
import { configureJiraInstance, getJiraConfig } from "../../services/sources/jiraService.ts";
import { confluenceService } from "../../services/sources/confluenceService.ts";
import type { DataSource } from "./types.ts";

/** The connectors whose sync schedule can be applied to a whole project at once. */
export type SyncSettingsProvider = "github" | "jira" | "confluence";

/** Shown in the project-wide form when the project's sources do not share one schedule. */
export const DEFAULT_PROJECT_SYNC_SCHEDULE: ConfigureGithubRepositoryRequest = {
  autoUpdate: true,
  schedule: { type: "INTERVAL", everyMinutes: 60 },
};

/** The schedule to show in the project-wide form and whether the sources disagree on it. */
export type ProjectSyncSchedule = {
  config: ConfigureGithubRepositoryRequest;
  /** True when the sources have different schedules (or one could not be read). */
  isMixed: boolean;
};

type StoredSchedule = { autoUpdate: boolean; spec: GithubScheduleSpec | null };

/** One source of the project whose schedule is read and written. */
type ScheduleTarget = {
  load: () => Promise<StoredSchedule>;
  save: (request: ConfigureGithubRepositoryRequest) => Promise<void>;
};

function toTargets(
  provider: SyncSettingsProvider,
  sources: DataSource[],
  projectId: string | null,
): ScheduleTarget[] {
  const ofProvider = sources.filter((source) => source.sourceSystem === provider.toUpperCase());

  switch (provider) {
    case "github":
      return ofProvider.flatMap((source) => {
        const repository = source.githubRepository;
        if (!repository) return [];

        return [
          {
            load: () => getGithubRepositoryConfig(repository),
            save: (request) => configureGithubRepository(repository, request),
          },
        ];
      });
    case "jira":
      return ofProvider.flatMap((source) => {
        const instanceUrl = source.jiraInstance?.instanceUrl;
        if (!instanceUrl) return [];

        return [
          {
            load: () => getJiraConfig(instanceUrl),
            save: (request) => configureJiraInstance({ instanceUrl, ...request }),
          },
        ];
      });
    case "confluence":
      return ofProvider.flatMap((source) => {
        const connectionId = source.confluenceSpace?.connectionId;
        if (!connectionId) return [];
        if (!projectId) throw new Error("Select a project before using the sync schedule.");

        return [
          {
            load: async () => {
              const connection = await confluenceService.getConnection(projectId, connectionId);

              return { autoUpdate: connection.autoUpdate ?? false, spec: connection.spec ?? null };
            },
            save: async (request) => {
              await confluenceService.configureSchedule(projectId, connectionId, {
                schedule: request.schedule,
                autoUpdate: request.autoUpdate,
              });
            },
          },
        ];
      });
  }
}

/**
 * Comparable form of a stored schedule. The backend writes times as `HH:mm:ss`
 * while older rows may carry `HH:mm`, and the weekday order is irrelevant, so
 * both are normalised before two sources are compared.
 */
function scheduleKey({ autoUpdate, spec }: StoredSchedule): string {
  if (!spec) return JSON.stringify({ autoUpdate, spec: null });

  const time = "time" in spec ? spec.time.replace(/^(\d{2}:\d{2})$/, "$1:00") : undefined;
  const daysOfWeek = "daysOfWeek" in spec ? [...spec.daysOfWeek].sort() : undefined;

  return JSON.stringify({ autoUpdate, spec: { ...spec, time, daysOfWeek } });
}

/**
 * Reads the schedule of every source of one connector in the project. When they
 * all share one schedule, that schedule is returned so the form shows what is
 * really configured; otherwise the default is returned and the result is flagged
 * as mixed. A source whose schedule cannot be read counts as a difference, since
 * its schedule is unknown.
 */
export async function loadProjectSyncSchedule(
  provider: SyncSettingsProvider,
  sources: DataSource[],
  projectId: string | null,
): Promise<ProjectSyncSchedule> {
  const results = await Promise.allSettled(
    toTargets(provider, sources, projectId).map((target) => target.load()),
  );

  const stored = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const hasUnreadable = stored.length < results.length;
  const isMixed = hasUnreadable || new Set(stored.map(scheduleKey)).size > 1;

  if (isMixed || stored.length === 0 || !stored[0].spec) {
    return { config: DEFAULT_PROJECT_SYNC_SCHEDULE, isMixed };
  }

  return { config: { autoUpdate: stored[0].autoUpdate, schedule: stored[0].spec }, isMixed };
}

/**
 * Applies one schedule to every source of one connector in the project. Every
 * source is attempted even if one fails; the failures are reported as a single
 * "x of y" error so the form can show what did not go through.
 *
 * @param pluralNoun - How the connector's sources are named in that error, e.g. "GitHub repositories".
 */
export async function saveProjectSyncSchedule(
  provider: SyncSettingsProvider,
  sources: DataSource[],
  projectId: string | null,
  request: ConfigureGithubRepositoryRequest,
  pluralNoun: string,
): Promise<void> {
  const targets = toTargets(provider, sources, projectId);
  const results = await Promise.allSettled(targets.map((target) => target.save(request)));

  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    throw new Error(`Couldn't apply the schedule to ${failed} of ${results.length} ${pluralNoun}.`);
  }
}
