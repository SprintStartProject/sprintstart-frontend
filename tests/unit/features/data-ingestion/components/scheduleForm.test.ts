import { describe, expect, it } from "vitest";
import {
  buildScheduleSpec,
  DEFAULT_FORM_VALUES,
  formatDayLabel,
  mergeSpec,
  normalizeTimeInput,
  serializeFormValues,
  toFormValues,
  toggleDay,
  type FormValues,
} from "../../../../../src/features/data-ingestion/components/syncSchedule/scheduleForm";
import { intervalOptionsFor } from "../../../../../src/features/data-ingestion/components/syncSchedule/scheduleOptions";

function form(over: Partial<FormValues> = {}): FormValues {
  return { ...DEFAULT_FORM_VALUES, ...over };
}

describe("normalizeTimeInput", () => {
  it("keeps HH:mm:ss, pads HH:mm and falls back for anything else", () => {
    expect(normalizeTimeInput("03:04:05")).toBe("03:04:05");
    expect(normalizeTimeInput("03:04")).toBe("03:04:00");
    expect(normalizeTimeInput("3:04")).toBe("02:00:00");
    expect(normalizeTimeInput("")).toBe("02:00:00");
  });
});

describe("toFormValues", () => {
  it("is the defaults with the given auto-update when there is no spec", () => {
    expect(toFormValues(false, null)).toEqual({ ...DEFAULT_FORM_VALUES, autoUpdate: false });
  });

  it("projects each spec type and leaves the other fields at their defaults", () => {
    expect(toFormValues(true, { type: "INTERVAL", everyMinutes: 15 })).toEqual(
      form({ everyMinutes: "15" }),
    );
    expect(toFormValues(true, { type: "DAILY", time: "05:30" })).toEqual(
      form({ scheduleType: "DAILY", time: "05:30:00" }),
    );
    expect(
      toFormValues(true, { type: "WEEKLY", time: "05:30:00", daysOfWeek: ["FRIDAY"] }),
    ).toEqual(form({ scheduleType: "WEEKLY", time: "05:30:00", daysOfWeek: ["FRIDAY"] }));
    expect(toFormValues(true, { type: "MONTHLY", time: "01:00:00", dayOfMonth: 15 })).toEqual(
      form({ scheduleType: "MONTHLY", time: "01:00:00", dayOfMonth: "15" }),
    );
    expect(toFormValues(true, { type: "CUSTOM", cron: "0 0 * * * *" })).toEqual(
      form({ scheduleType: "CUSTOM", cron: "0 0 * * * *" }),
    );
  });
});

describe("mergeSpec", () => {
  const typed = form({
    everyMinutes: "120",
    time: "09:00:00",
    daysOfWeek: ["TUESDAY"],
    dayOfMonth: "9",
    cron: "typed",
  });

  it("falls back to the default interval without a spec, keeping the rest", () => {
    const merged = mergeSpec({ ...typed, scheduleType: "CUSTOM" }, null);
    expect(merged).toEqual({ ...typed, scheduleType: "INTERVAL", everyMinutes: "60" });
  });

  it("changes only the fields the spec's type uses", () => {
    expect(mergeSpec(typed, { type: "INTERVAL", everyMinutes: 5 })).toEqual({
      ...typed,
      scheduleType: "INTERVAL",
      everyMinutes: "5",
    });
    expect(mergeSpec(typed, { type: "DAILY", time: "04:00" })).toEqual({
      ...typed,
      scheduleType: "DAILY",
      time: "04:00:00",
    });
    expect(mergeSpec(typed, { type: "WEEKLY", time: "04:00:00", daysOfWeek: ["SUNDAY"] })).toEqual({
      ...typed,
      scheduleType: "WEEKLY",
      time: "04:00:00",
      daysOfWeek: ["SUNDAY"],
    });
    expect(mergeSpec(typed, { type: "MONTHLY", time: "04:00:00", dayOfMonth: 3 })).toEqual({
      ...typed,
      scheduleType: "MONTHLY",
      time: "04:00:00",
      dayOfMonth: "3",
    });
    expect(mergeSpec(typed, { type: "CUSTOM", cron: "* * * * * *" })).toEqual({
      ...typed,
      scheduleType: "CUSTOM",
      cron: "* * * * * *",
    });
  });
});

describe("serializeFormValues", () => {
  it("ignores fields the selected type does not persist", () => {
    expect(serializeFormValues(form({ everyMinutes: "5", cron: "a" }))).toBe(
      serializeFormValues(form({ everyMinutes: "5", cron: "b", time: "10:00:00" })),
    );
    expect(serializeFormValues(form({ scheduleType: "CUSTOM", cron: "a" }))).not.toBe(
      serializeFormValues(form({ scheduleType: "CUSTOM", cron: "b" })),
    );
  });

  it("tells every type, and auto-update, apart", () => {
    const keys = (["INTERVAL", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"] as const).map((type) =>
      serializeFormValues(form({ scheduleType: type })),
    );
    expect(new Set(keys).size).toBe(5);
    expect(serializeFormValues(form({ autoUpdate: false }))).not.toBe(serializeFormValues(form()));
  });

  it("treats 02:00 and 02:00:00 as the same time", () => {
    expect(serializeFormValues(form({ scheduleType: "DAILY", time: "02:00" }))).toBe(
      serializeFormValues(form({ scheduleType: "DAILY", time: "02:00:00" })),
    );
  });

  it("ignores weekday order but not which days", () => {
    const weekly = (days: FormValues["daysOfWeek"]) =>
      serializeFormValues(form({ scheduleType: "WEEKLY", daysOfWeek: days }));
    expect(weekly(["FRIDAY", "MONDAY"])).toBe(weekly(["MONDAY", "FRIDAY"]));
    expect(weekly(["MONDAY"])).not.toBe(weekly(["MONDAY", "FRIDAY"]));
  });

  it("includes the day of month and the time for monthly", () => {
    const monthly = (over: Partial<FormValues>) =>
      serializeFormValues(form({ scheduleType: "MONTHLY", ...over }));
    expect(monthly({ dayOfMonth: "1" })).not.toBe(monthly({ dayOfMonth: "2" }));
    expect(monthly({ time: "01:00:00" })).not.toBe(monthly({ time: "02:00:00" }));
  });
});

describe("buildScheduleSpec", () => {
  it("builds every type", () => {
    expect(buildScheduleSpec(form({ everyMinutes: "30" }))).toEqual({
      type: "INTERVAL",
      everyMinutes: 30,
    });
    expect(buildScheduleSpec(form({ scheduleType: "DAILY", time: "03:00" }))).toEqual({
      type: "DAILY",
      time: "03:00:00",
    });
    expect(
      buildScheduleSpec(form({ scheduleType: "WEEKLY", time: "03:00:00", daysOfWeek: ["MONDAY"] })),
    ).toEqual({ type: "WEEKLY", time: "03:00:00", daysOfWeek: ["MONDAY"] });
    expect(
      buildScheduleSpec(form({ scheduleType: "MONTHLY", time: "03:00:00", dayOfMonth: "31" })),
    ).toEqual({ type: "MONTHLY", time: "03:00:00", dayOfMonth: 31 });
    expect(buildScheduleSpec(form({ scheduleType: "CUSTOM", cron: "  0 0 * * * *  " }))).toEqual({
      type: "CUSTOM",
      cron: "0 0 * * * *",
    });
  });

  it.each(["0", "-5", "1.5", "abc"])("rejects the interval %s", (everyMinutes) => {
    expect(() => buildScheduleSpec(form({ everyMinutes }))).toThrow(
      "Interval must be at least 1 minute.",
    );
  });

  it("accepts an interval of exactly 1", () => {
    expect(buildScheduleSpec(form({ everyMinutes: "1" }))).toEqual({
      type: "INTERVAL",
      everyMinutes: 1,
    });
  });

  it("rejects a weekly schedule with no days", () => {
    expect(() => buildScheduleSpec(form({ scheduleType: "WEEKLY", daysOfWeek: [] }))).toThrow(
      "Select at least one weekday.",
    );
  });

  it.each(["0", "32", "1.5", "x"])("rejects the day of month %s", (dayOfMonth) => {
    expect(() => buildScheduleSpec(form({ scheduleType: "MONTHLY", dayOfMonth }))).toThrow(
      "Day of month must be between 1 and 31.",
    );
  });

  it("accepts the first and last day of the month", () => {
    expect(buildScheduleSpec(form({ scheduleType: "MONTHLY", dayOfMonth: "1" }))).toMatchObject({
      dayOfMonth: 1,
    });
    expect(buildScheduleSpec(form({ scheduleType: "MONTHLY", dayOfMonth: "31" }))).toMatchObject({
      dayOfMonth: 31,
    });
  });

  it("rejects a blank cron", () => {
    expect(() => buildScheduleSpec(form({ scheduleType: "CUSTOM", cron: "   " }))).toThrow(
      "Cron expression is required.",
    );
  });

  it("rejects a malformed time for daily, weekly and monthly", () => {
    for (const scheduleType of ["DAILY", "WEEKLY", "MONTHLY"] as const) {
      expect(() => buildScheduleSpec(form({ scheduleType, time: "noon" }))).toThrow(
        "Time must use HH:mm:ss.",
      );
    }
  });
});

describe("toggleDay and formatDayLabel", () => {
  it("adds a missing day at the end and removes a present one", () => {
    expect(toggleDay(["MONDAY"], "FRIDAY")).toEqual(["MONDAY", "FRIDAY"]);
    expect(toggleDay(["MONDAY", "FRIDAY"], "MONDAY")).toEqual(["FRIDAY"]);
  });

  it("abbreviates a day to three letters, capitalised", () => {
    expect(formatDayLabel("WEDNESDAY")).toBe("Wed");
    expect(formatDayLabel("SUNDAY")).toBe("Sun");
  });
});

describe("intervalOptionsFor", () => {
  it("offers the curated list for a curated or unreadable value", () => {
    expect(intervalOptionsFor("60")).toEqual([5, 10, 15, 20, 30, 60]);
    expect(intervalOptionsFor("abc")).toEqual([5, 10, 15, 20, 30, 60]);
  });

  it("adds a stored value outside the list, in order", () => {
    expect(intervalOptionsFor("12")).toEqual([5, 10, 12, 15, 20, 30, 60]);
    expect(intervalOptionsFor("120")).toEqual([5, 10, 15, 20, 30, 60, 120]);
  });
});
