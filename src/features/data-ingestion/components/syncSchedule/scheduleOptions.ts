import type { SegmentedTabOption } from "../../../../components/ui/SegmentedTabs.tsx";
import type { ScheduleDayOfWeek } from "../../../../services/sources/syncSchedule.ts";
import type { ScheduleType } from "./scheduleForm";

export const SCHEDULE_TYPES: SegmentedTabOption<ScheduleType>[] = [
  { value: "INTERVAL", label: "Interval" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom" },
];

export const DAYS_OF_WEEK: ScheduleDayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/**
 * The minute values offered: every one divides 60, so a cron step keeps a steady cadence. The
 * list is curated, not exhaustive (4, 6 and 12 divide 60 too) — what it must not offer is a
 * value the schedule quietly changes meaning on: a 45-minute step fires at minute 0 and 45 and
 * then again at the next hour's 0, and a two-hour step collapses to once an hour. A free number
 * let both be saved. A stored value outside this list is still shown (see `intervalOptionsFor`),
 * so the control never lies about what is saved.
 */
const INTERVAL_MINUTE_OPTIONS: readonly number[] = [5, 10, 15, 20, 30, 60];

/**
 * The offered minutes, plus whatever a stored config already holds — the same "an extra option so
 * the control never lies" treatment the page-size control gives a hand-edited size.
 */
export function intervalOptionsFor(everyMinutes: string): readonly number[] {
  const current = Number(everyMinutes);
  if (!Number.isFinite(current) || INTERVAL_MINUTE_OPTIONS.includes(current)) {
    return INTERVAL_MINUTE_OPTIONS;
  }
  return [...INTERVAL_MINUTE_OPTIONS, current].sort((a, b) => a - b);
}
