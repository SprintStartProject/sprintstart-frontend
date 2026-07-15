import { CalendarClock, Loader2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle.tsx";
import { formatDateTime } from "../data.ts";
import type {
  ConfigureGithubRepositoryRequest,
  GithubRepositoryConfig,
  GithubScheduleDayOfWeek,
  GithubScheduleSpec,
} from "../../../services/sources/githubService.ts";

type ScheduleType = GithubScheduleSpec["type"];

type GithubRepositorySyncSettingsProps = {
  loadKey?: string;
  loadConfig?: () => Promise<GithubRepositoryConfig>;
  initialConfig?: ConfigureGithubRepositoryRequest;
  onSave: (request: ConfigureGithubRepositoryRequest) => Promise<void>;
  disclaimer?: string;
  showNextSync?: boolean;
  autoUpdateOnText?: string;
  autoUpdateOffText?: string;
  toggleAriaLabel?: string;
  saveLabel?: string;
};

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "INTERVAL", label: "Interval" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom cron" },
];

const DAYS_OF_WEEK: GithubScheduleDayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/**
 * Compact GitHub sync control shared by the global modal and repository
 * details drawer. It intentionally exposes the day-to-day knobs PMs need:
 * whether due checks should perform an update, and the interval cadence.
 */
export function GithubRepositorySyncSettings({
  loadKey,
  loadConfig,
  initialConfig,
  onSave,
  disclaimer,
  showNextSync = true,
  autoUpdateOnText = "Due checks update this repository.",
  autoUpdateOffText = "Due checks only mark this repository out of date.",
  toggleAriaLabel = "Toggle repository auto update",
  saveLabel = "Save",
}: GithubRepositorySyncSettingsProps) {
  const scheduleTypeId = useId();
  const intervalInputId = useId();
  const timeInputId = useId();
  const dayOfMonthInputId = useId();
  const cronInputId = useId();
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("INTERVAL");
  const [everyMinutes, setEveryMinutes] = useState("60");
  const [time, setTime] = useState("02:00:00");
  const [daysOfWeek, setDaysOfWeek] = useState<GithubScheduleDayOfWeek[]>([
    "MONDAY",
  ]);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [cron, setCron] = useState("0 0 2 * * *");
  const [nextSyncAt, setNextSyncAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "idle" | "error">(
    loadConfig ? "loading" : "idle",
  );
  const [saveState, setSaveState] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loadConfig || !initialConfig) return;

    void Promise.resolve().then(() => {
      setAutoUpdate(initialConfig.autoUpdate);
      applyScheduleSpec(initialConfig.schedule, {
        setScheduleType,
        setEveryMinutes,
        setTime,
        setDaysOfWeek,
        setDayOfMonth,
        setCron,
      });
    });
  }, [initialConfig, loadConfig]);

  useEffect(() => {
    let isMounted = true;

    if (!loadConfig) return undefined;

    void Promise.resolve().then(async () => {
      if (!isMounted) return;

      setLoadState("loading");
      setErrorMessage(null);

      try {
        const config = await loadConfig();

        if (!isMounted) return;

        setAutoUpdate(config.autoUpdate);
        applyScheduleSpec(config.spec, {
          setScheduleType,
          setEveryMinutes,
          setTime,
          setDaysOfWeek,
          setDayOfMonth,
          setCron,
        });
        setNextSyncAt(config.nextSyncAt);
        setLoadState("idle");
      } catch (error) {
        if (!isMounted) return;

        setLoadState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load sync config",
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadConfig, loadKey]);

  const saveSettings = async () => {
    setSaveState("loading");
    setMessage(null);
    setErrorMessage(null);

    try {
      const schedule = buildScheduleSpec({
        scheduleType,
        everyMinutes,
        time,
        daysOfWeek,
        dayOfMonth,
        cron,
      });

      await onSave({
        autoUpdate,
        schedule,
      });

      if (loadConfig) {
        const config = await loadConfig();
        setAutoUpdate(config.autoUpdate);
        applyScheduleSpec(config.spec, {
          setScheduleType,
          setEveryMinutes,
          setTime,
          setDaysOfWeek,
          setDayOfMonth,
          setCron,
        });
        setNextSyncAt(config.nextSyncAt);
      }

      setSaveState("success");
      setMessage("Sync settings saved.");
    } catch (error) {
      setSaveState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save sync config",
      );
    }
  };

  const isBusy = loadState === "loading" || saveState === "loading";
  const usesTimeInput = ["DAILY", "WEEKLY", "MONTHLY"].includes(scheduleType);

  return (
    <div className="rounded-xl border border-app-border bg-app-surface-muted p-4">
      {message && (
        <div className="mb-4 rounded-xl border border-app-success-border bg-app-success-bg px-3 py-2 text-sm text-app-success-text">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-2 text-sm text-app-warning-text">
          {errorMessage}
        </div>
      )}

      {disclaimer && (
        <div className="mb-4 rounded-xl border border-app-warning-border bg-app-warning-bg px-3 py-2 text-sm text-app-warning-text">
          {disclaimer}
        </div>
      )}

      {showNextSync && (
        <div className="mb-4 flex flex-col gap-2 border-b border-app-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-app-text">Next sync</p>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-app-text">
            <CalendarClock className="h-4 w-4 text-app-text-muted" />
            {nextSyncAt ? formatDateTime(nextSyncAt) : "Not available"}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm font-semibold text-app-text">Auto update</p>
          <p className="mt-1 text-xs text-app-text-muted">
            {autoUpdate ? autoUpdateOnText : autoUpdateOffText}
          </p>
        </div>

        <AccountEnabledToggle
          enabled={autoUpdate}
          disabled={isBusy}
          ariaLabel={toggleAriaLabel}
          onChange={setAutoUpdate}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={scheduleTypeId}
            className="text-sm font-medium text-app-text"
          >
            Schedule
          </label>
          <select
            id={scheduleTypeId}
            value={scheduleType}
            disabled={isBusy}
            onChange={(event) => setScheduleType(event.target.value as ScheduleType)}
            className="mt-2 h-10 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text focus:border-app-brand focus:outline-none focus:ring-2 focus:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SCHEDULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {scheduleType === "INTERVAL" && (
          <div>
            <label
              htmlFor={intervalInputId}
              className="text-sm font-medium text-app-text"
            >
              Minutes
            </label>
            <div className="mt-2 flex min-h-10 items-center rounded-xl border border-app-border bg-app-surface focus-within:border-app-brand focus-within:ring-2 focus-within:ring-app-focus">
              <span className="pl-3 text-sm text-app-text-muted">Every</span>
              <input
                id={intervalInputId}
                type="number"
                min="1"
                value={everyMinutes}
                disabled={isBusy}
                onChange={(event) => setEveryMinutes(event.target.value)}
                className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm font-semibold text-app-text focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="pr-3 text-sm text-app-text-muted">minutes</span>
            </div>
          </div>
        )}

        {usesTimeInput && (
          <label className="block">
            <span className="text-sm font-medium text-app-text">Time</span>
            <input
              id={timeInputId}
              type="time"
              step="1"
              value={time}
              disabled={isBusy}
              onChange={(event) => setTime(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text focus:border-app-brand focus:outline-none focus:ring-2 focus:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        )}

        {scheduleType === "CUSTOM" && (
          <label className="block">
            <span className="text-sm font-medium text-app-text">Cron</span>
            <input
              id={cronInputId}
              type="text"
              value={cron}
              disabled={isBusy}
              onChange={(event) => setCron(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-app-border bg-app-surface px-3 font-mono text-sm font-semibold text-app-text focus:border-app-brand focus:outline-none focus:ring-2 focus:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        )}
      </div>

      {scheduleType === "WEEKLY" && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-app-text">Days</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = daysOfWeek.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isBusy}
                  onClick={() => setDaysOfWeek((current) => toggleDay(current, day))}
                  className={[
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected
                      ? "border-app-brand-border-strong bg-app-brand text-app-text-inverse"
                      : "border-app-border bg-app-surface text-app-text-muted hover:text-app-text",
                  ].join(" ")}
                >
                  {formatDayLabel(day)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {scheduleType === "MONTHLY" && (
        <label className="mt-4 block max-w-48">
          <span className="text-sm font-medium text-app-text">Day of month</span>
          <input
            id={dayOfMonthInputId}
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            disabled={isBusy}
            onChange={(event) => setDayOfMonth(event.target.value)}
            className="mt-2 h-10 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-semibold text-app-text focus:border-app-brand focus:outline-none focus:ring-2 focus:ring-app-focus disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            void saveSettings();
          }}
          disabled={isBusy}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-app-brand px-4 text-sm font-semibold text-app-text-inverse transition hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {saveState === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveState === "loading" ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

type ScheduleSetters = {
  setScheduleType: (value: ScheduleType) => void;
  setEveryMinutes: (value: string) => void;
  setTime: (value: string) => void;
  setDaysOfWeek: (value: GithubScheduleDayOfWeek[]) => void;
  setDayOfMonth: (value: string) => void;
  setCron: (value: string) => void;
};

function applyScheduleSpec(
  spec: GithubRepositoryConfig["spec"] | ConfigureGithubRepositoryRequest["schedule"],
  setters: ScheduleSetters,
) {
  if (!spec) {
    setters.setScheduleType("INTERVAL");
    setters.setEveryMinutes("60");
    return;
  }

  setters.setScheduleType(spec.type);

  switch (spec.type) {
    case "INTERVAL":
      setters.setEveryMinutes(String(spec.everyMinutes));
      break;
    case "DAILY":
      setters.setTime(normalizeTimeInput(spec.time));
      break;
    case "WEEKLY":
      setters.setTime(normalizeTimeInput(spec.time));
      setters.setDaysOfWeek(spec.daysOfWeek);
      break;
    case "MONTHLY":
      setters.setTime(normalizeTimeInput(spec.time));
      setters.setDayOfMonth(String(spec.dayOfMonth));
      break;
    case "CUSTOM":
      setters.setCron(spec.cron);
      break;
  }
}

function buildScheduleSpec({
  scheduleType,
  everyMinutes,
  time,
  daysOfWeek,
  dayOfMonth,
  cron,
}: {
  scheduleType: ScheduleType;
  everyMinutes: string;
  time: string;
  daysOfWeek: GithubScheduleDayOfWeek[];
  dayOfMonth: string;
  cron: string;
}): GithubScheduleSpec {
  switch (scheduleType) {
    case "INTERVAL": {
      const interval = Number(everyMinutes);

      if (!Number.isInteger(interval) || interval < 1) {
        throw new Error("Interval must be at least 1 minute.");
      }

      return { type: "INTERVAL", everyMinutes: interval };
    }
    case "DAILY":
      return { type: "DAILY", time: normalizeTimeOutput(time) };
    case "WEEKLY":
      if (daysOfWeek.length === 0) {
        throw new Error("Select at least one weekday.");
      }

      return {
        type: "WEEKLY",
        time: normalizeTimeOutput(time),
        daysOfWeek,
      };
    case "MONTHLY": {
      const day = Number(dayOfMonth);

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error("Day of month must be between 1 and 31.");
      }

      return {
        type: "MONTHLY",
        time: normalizeTimeOutput(time),
        dayOfMonth: day,
      };
    }
    case "CUSTOM": {
      const trimmedCron = cron.trim();

      if (!trimmedCron) {
        throw new Error("Cron expression is required.");
      }

      return { type: "CUSTOM", cron: trimmedCron };
    }
  }
}

function normalizeTimeInput(value: string) {
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return "02:00:00";
}

function normalizeTimeOutput(value: string) {
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  throw new Error("Time must use HH:mm:ss.");
}

function toggleDay(
  selectedDays: GithubScheduleDayOfWeek[],
  day: GithubScheduleDayOfWeek,
) {
  if (selectedDays.includes(day)) {
    return selectedDays.filter((selectedDay) => selectedDay !== day);
  }

  return [...selectedDays, day];
}

function formatDayLabel(day: GithubScheduleDayOfWeek) {
  return day.slice(0, 3).toLowerCase().replace(/^\w/, (char) =>
    char.toUpperCase(),
  );
}
