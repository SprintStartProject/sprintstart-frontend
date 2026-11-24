import type {
  ScheduleDayOfWeek,
  ScheduleSpec,
  SyncScheduleConfig,
} from "../../../../services/sources/syncSchedule.ts";

export type ScheduleType = ScheduleSpec["type"];

export type FormValues = {
  autoUpdate: boolean;
  scheduleType: ScheduleType;
  everyMinutes: string;
  time: string;
  daysOfWeek: ScheduleDayOfWeek[];
  dayOfMonth: string;
  cron: string;
};

export const DEFAULT_FORM_VALUES: FormValues = {
  autoUpdate: true,
  scheduleType: "INTERVAL",
  everyMinutes: "60",
  time: "02:00:00",
  daysOfWeek: ["MONDAY"],
  dayOfMonth: "1",
  cron: "0 0 2 * * *",
};

export function normalizeTimeInput(value: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return "02:00:00";
}

function normalizeTimeOutput(value: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  throw new Error("Time must use HH:mm:ss.");
}

/**
 * Projects a stored/initial config into the full set of form field values
 * (filling the fields the active schedule type does not use with defaults), so
 * the saved baseline is comparable to the live form for dirty detection.
 */
export function toFormValues(autoUpdate: boolean, spec: SyncScheduleConfig["spec"]): FormValues {
  const base: FormValues = { ...DEFAULT_FORM_VALUES, autoUpdate };

  if (!spec) return base;

  switch (spec.type) {
    case "INTERVAL":
      return { ...base, scheduleType: "INTERVAL", everyMinutes: String(spec.everyMinutes) };
    case "DAILY":
      return { ...base, scheduleType: "DAILY", time: normalizeTimeInput(spec.time) };
    case "WEEKLY":
      return {
        ...base,
        scheduleType: "WEEKLY",
        time: normalizeTimeInput(spec.time),
        daysOfWeek: spec.daysOfWeek,
      };
    case "MONTHLY":
      return {
        ...base,
        scheduleType: "MONTHLY",
        time: normalizeTimeInput(spec.time),
        dayOfMonth: String(spec.dayOfMonth),
      };
    case "CUSTOM":
      return { ...base, scheduleType: "CUSTOM", cron: spec.cron };
  }
}

/**
 * Lays a stored spec over the live form: the schedule type and the fields that type uses change,
 * every other field keeps what was last loaded or typed. No spec means the default interval.
 */
export function mergeSpec(form: FormValues, spec: SyncScheduleConfig["spec"]): FormValues {
  if (!spec) return { ...form, scheduleType: "INTERVAL", everyMinutes: "60" };

  const next: FormValues = { ...form, scheduleType: spec.type };

  switch (spec.type) {
    case "INTERVAL":
      return { ...next, everyMinutes: String(spec.everyMinutes) };
    case "DAILY":
      return { ...next, time: normalizeTimeInput(spec.time) };
    case "WEEKLY":
      return { ...next, time: normalizeTimeInput(spec.time), daysOfWeek: spec.daysOfWeek };
    case "MONTHLY":
      return {
        ...next,
        time: normalizeTimeInput(spec.time),
        dayOfMonth: String(spec.dayOfMonth),
      };
    case "CUSTOM":
      return { ...next, cron: spec.cron };
  }
}

/**
 * Serializes only the values the selected schedule type actually persists, so
 * dirty detection answers "would saving change anything?".
 *
 * Serializing the whole form instead produced "You have unsaved changes" that
 * could never be cleared: the fields belonging to *other* schedule types keep
 * whatever was last loaded or typed (switching from INTERVAL 120 to WEEKLY
 * leaves `everyMinutes` at "120"), while the post-save baseline is rebuilt from
 * the saved spec and falls back to {@link DEFAULT_FORM_VALUES} for them.
 *
 * `time` is normalized here too: the time input yields "02:00" while a spec
 * round-trip yields "02:00:00", which otherwise never compared equal.
 */
export function serializeFormValues(values: FormValues): string {
  const { autoUpdate, scheduleType } = values;

  switch (scheduleType) {
    case "INTERVAL":
      return JSON.stringify({ autoUpdate, scheduleType, everyMinutes: values.everyMinutes });
    case "DAILY":
      return JSON.stringify({ autoUpdate, scheduleType, time: normalizeTimeInput(values.time) });
    case "WEEKLY":
      return JSON.stringify({
        autoUpdate,
        scheduleType,
        time: normalizeTimeInput(values.time),
        daysOfWeek: [...values.daysOfWeek].sort(),
      });
    case "MONTHLY":
      return JSON.stringify({
        autoUpdate,
        scheduleType,
        time: normalizeTimeInput(values.time),
        dayOfMonth: values.dayOfMonth,
      });
    case "CUSTOM":
      return JSON.stringify({ autoUpdate, scheduleType, cron: values.cron });
  }
}

function intervalSpec(form: FormValues): ScheduleSpec {
  const interval = Number(form.everyMinutes);

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("Interval must be at least 1 minute.");
  }

  return { type: "INTERVAL", everyMinutes: interval };
}

function weeklySpec(form: FormValues): ScheduleSpec {
  if (form.daysOfWeek.length === 0) {
    throw new Error("Select at least one weekday.");
  }

  return { type: "WEEKLY", time: normalizeTimeOutput(form.time), daysOfWeek: form.daysOfWeek };
}

function monthlySpec(form: FormValues): ScheduleSpec {
  const day = Number(form.dayOfMonth);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Day of month must be between 1 and 31.");
  }

  return { type: "MONTHLY", time: normalizeTimeOutput(form.time), dayOfMonth: day };
}

function customSpec(form: FormValues): ScheduleSpec {
  const trimmedCron = form.cron.trim();

  if (!trimmedCron) {
    throw new Error("Cron expression is required.");
  }

  return { type: "CUSTOM", cron: trimmedCron };
}

/** The spec to save for the form as it stands; throws a readable message when it is not valid. */
export function buildScheduleSpec(form: FormValues): ScheduleSpec {
  switch (form.scheduleType) {
    case "INTERVAL":
      return intervalSpec(form);
    case "DAILY":
      return { type: "DAILY", time: normalizeTimeOutput(form.time) };
    case "WEEKLY":
      return weeklySpec(form);
    case "MONTHLY":
      return monthlySpec(form);
    case "CUSTOM":
      return customSpec(form);
  }
}

export function toggleDay(
  selectedDays: ScheduleDayOfWeek[],
  day: ScheduleDayOfWeek,
): ScheduleDayOfWeek[] {
  if (selectedDays.includes(day)) {
    return selectedDays.filter((selectedDay) => selectedDay !== day);
  }

  return [...selectedDays, day];
}

export function formatDayLabel(day: ScheduleDayOfWeek): string {
  return day
    .slice(0, 3)
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}
