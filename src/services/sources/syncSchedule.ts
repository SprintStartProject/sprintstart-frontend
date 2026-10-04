/**
 * The sync schedule contract shared by every connector that polls its upstream
 * (GitHub repositories, Jira instances, Confluence spaces): one typed schedule
 * spec plus the auto-update switch. The backend converts the spec into the stored
 * cron expression.
 */

export type ScheduleDayOfWeek =
  "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export type ScheduleSpec =
  | {
      type: "DAILY";
      time: string;
    }
  | {
      type: "WEEKLY";
      time: string;
      daysOfWeek: ScheduleDayOfWeek[];
    }
  | {
      type: "MONTHLY";
      time: string;
      dayOfMonth: number;
    }
  | {
      type: "INTERVAL";
      everyMinutes: number;
    }
  | {
      type: "CUSTOM";
      cron: string;
    };

/** What is sent to a connector's schedule endpoint. */
export type SyncScheduleRequest = {
  autoUpdate: boolean;
  schedule: ScheduleSpec;
};

/**
 * The part of a loaded connector config the schedule form reads. Every
 * connector's config response (GitHub repository, Jira instance, Confluence
 * connection) satisfies it.
 */
export type SyncScheduleConfig = {
  autoUpdate: boolean;
  spec: ScheduleSpec | null;
  /** ISO-8601 instant of the next scheduled sync, or null. */
  nextSyncAt: string | null;
};

/** The schedule the form starts from when nothing is configured yet. */
export const DEFAULT_SYNC_SCHEDULE: SyncScheduleRequest = {
  autoUpdate: true,
  schedule: { type: "INTERVAL", everyMinutes: 60 },
};
