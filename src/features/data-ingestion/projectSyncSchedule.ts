import {
  DEFAULT_SYNC_SCHEDULE,
  type ScheduleSpec,
  type SyncScheduleRequest,
} from "../../services/sources/syncSchedule.ts";
import { getConnector } from "./connectors/registry.ts";
import type { SourceSystem } from "./connectors/sourceSystems.ts";
import type { DataSource } from "./types.ts";

/** The schedule to show in the project-wide form and whether the sources disagree on it. */
export type ProjectSyncSchedule = {
  config: SyncScheduleRequest;
  /** True when the sources have different schedules (or one could not be read). */
  isMixed: boolean;
};

type StoredSchedule = { autoUpdate: boolean; spec: ScheduleSpec | null };

/** One source of the project whose schedule is read and written. */
type ScheduleTarget = {
  load: () => Promise<StoredSchedule>;
  save: (request: SyncScheduleRequest) => Promise<void>;
};

/**
 * The project's sources of one connector that have a schedule to read and write,
 * through the connector's own `schedule` action. A connector without one, or a
 * source that cannot be resolved to its upstream, has no target.
 */
function toTargets(
  system: SourceSystem,
  sources: DataSource[],
  projectId: string | null,
): ScheduleTarget[] {
  const schedule = getConnector(system).actions.schedule;
  if (!schedule) return [];

  const context = { projectId };

  return sources
    .filter((source) => source.sourceSystem === system && schedule.isAvailable(source))
    .map((source) => ({
      load: () => schedule.load(source, context),
      save: (request) => schedule.save(source, request, context),
    }));
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
  system: SourceSystem,
  sources: DataSource[],
  projectId: string | null,
): Promise<ProjectSyncSchedule> {
  const results = await Promise.allSettled(
    toTargets(system, sources, projectId).map((target) => target.load()),
  );

  const stored = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const hasUnreadable = stored.length < results.length;
  const isMixed = hasUnreadable || new Set(stored.map(scheduleKey)).size > 1;

  if (isMixed || stored.length === 0 || !stored[0].spec) {
    return { config: DEFAULT_SYNC_SCHEDULE, isMixed };
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
  system: SourceSystem,
  sources: DataSource[],
  projectId: string | null,
  request: SyncScheduleRequest,
  pluralNoun: string,
): Promise<void> {
  const targets = toTargets(system, sources, projectId);
  const results = await Promise.allSettled(targets.map((target) => target.save(request)));

  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    throw new Error(`Couldn't apply the schedule to ${failed} of ${results.length} ${pluralNoun}.`);
  }
}
