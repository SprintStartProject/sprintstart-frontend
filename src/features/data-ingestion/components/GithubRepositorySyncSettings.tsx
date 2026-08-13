import { CalendarClock } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "../../../components/ui/Input.tsx";
import { SaveButton } from "../../../components/ui/SaveButton.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import { AccountEnabledToggle } from "../../admin/components/AccountEnabledToggle.tsx";
import { formatDateTime } from "../data.ts";
import type {
  ConfigureGithubRepositoryRequest,
  GithubRepositoryConfig,
  GithubScheduleDayOfWeek,
  GithubScheduleSpec,
} from "../../../services/sources/githubService.ts";

type ScheduleType = GithubScheduleSpec["type"];

/**
 * The minimal loaded-config shape this schedule form actually reads. Both
 * {@link GithubRepositoryConfig} and the Jira instance config
 * (`GetJiraInstanceConfigResponse`) satisfy it, so the same control drives the
 * GitHub repository and Jira instance sync schedules — the two connectors share
 * an identical schedule contract ({@link GithubScheduleSpec}).
 */
export type SyncScheduleConfig = Pick<GithubRepositoryConfig, "autoUpdate" | "spec" | "nextSyncAt">;

type GithubRepositorySyncSettingsProps = {
  loadKey?: string;
  loadConfig?: () => Promise<SyncScheduleConfig>;
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
  const [daysOfWeek, setDaysOfWeek] = useState<GithubScheduleDayOfWeek[]>(["MONDAY"]);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [cron, setCron] = useState("0 0 2 * * *");
  const [nextSyncAt, setNextSyncAt] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "idle" | "error">(
    loadConfig ? "loading" : "idle",
  );
  const [saveState, setSaveState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Serialized snapshot of the last saved/loaded form values. Comparing the live
  // form against it is how the Save button knows whether there are unsaved
  // changes, so it can stay muted until the user actually edits something.
  const [baseline, setBaseline] = useState<string>(() =>
    serializeFormValues({
      autoUpdate: true,
      scheduleType: "INTERVAL",
      everyMinutes: "60",
      time: "02:00:00",
      daysOfWeek: ["MONDAY"],
      dayOfMonth: "1",
      cron: "0 0 2 * * *",
    }),
  );

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
      setBaseline(
        serializeFormValues(toFormValues(initialConfig.autoUpdate, initialConfig.schedule)),
      );
    });
  }, [initialConfig, loadConfig]);

  // Keep the latest loader in a ref so the load effect can depend only on the
  // stable `loadKey`. Without this the effect re-ran on every parent render
  // (the details page rebuilds `loadConfig`'s identity while polling), which
  // reloaded the config and discarded whatever the user had just selected.
  const loadConfigRef = useRef(loadConfig);
  useEffect(() => {
    loadConfigRef.current = loadConfig;
  });

  useEffect(() => {
    let isMounted = true;

    const loader = loadConfigRef.current;
    if (!loader) return undefined;

    void Promise.resolve().then(async () => {
      if (!isMounted) return;

      setLoadState("loading");
      setErrorMessage(null);

      try {
        const config = await loader();

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
        setBaseline(serializeFormValues(toFormValues(config.autoUpdate, config.spec)));
        setNextSyncAt(config.nextSyncAt);
        setLoadState("idle");
      } catch (error) {
        if (!isMounted) return;

        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Failed to load sync config");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadKey]);

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

      // The save succeeded, so the current values are now the clean baseline.
      setBaseline(serializeFormValues(toFormValues(autoUpdate, schedule)));

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
        setBaseline(serializeFormValues(toFormValues(config.autoUpdate, config.spec)));
        setNextSyncAt(config.nextSyncAt);
      }

      setSaveState("success");
      setMessage("Sync settings saved.");
    } catch (error) {
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to save sync config");
    }
  };

  const isBusy = loadState === "loading" || saveState === "loading";
  const usesTimeInput = ["DAILY", "WEEKLY", "MONTHLY"].includes(scheduleType);

  const currentSnapshot = useMemo(
    () =>
      serializeFormValues({
        autoUpdate,
        scheduleType,
        everyMinutes,
        time,
        daysOfWeek,
        dayOfMonth,
        cron,
      }),
    [autoUpdate, scheduleType, everyMinutes, time, daysOfWeek, dayOfMonth, cron],
  );
  const isDirty = currentSnapshot !== baseline;

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface-muted p-4">
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
          <label htmlFor={scheduleTypeId} className="text-sm font-medium text-app-text">
            Schedule
          </label>
          <Select
            id={scheduleTypeId}
            value={scheduleType}
            disabled={isBusy}
            onChange={(event) => setScheduleType(event.target.value as ScheduleType)}
            className="mt-2"
          >
            {SCHEDULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>

        {scheduleType === "INTERVAL" && (
          <div>
            <label htmlFor={intervalInputId} className="text-sm font-medium text-app-text">
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
          <label htmlFor={timeInputId} className="block">
            <span className="text-sm font-medium text-app-text">Time</span>
            <Input
              id={timeInputId}
              type="time"
              step="1"
              value={time}
              disabled={isBusy}
              onChange={(event) => setTime(event.target.value)}
              className="mt-2"
            />
          </label>
        )}

        {scheduleType === "CUSTOM" && (
          <label htmlFor={cronInputId} className="block">
            <span className="text-sm font-medium text-app-text">Cron</span>
            <Input
              id={cronInputId}
              type="text"
              value={cron}
              disabled={isBusy}
              onChange={(event) => setCron(event.target.value)}
              className="mt-2 font-mono"
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
                      ? "border-app-brand-border-strong bg-app-brand text-white"
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
        <label htmlFor={dayOfMonthInputId} className="mt-4 block max-w-48">
          <span className="text-sm font-medium text-app-text">Day of month</span>
          <Input
            id={dayOfMonthInputId}
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            disabled={isBusy}
            onChange={(event) => setDayOfMonth(event.target.value)}
            className="mt-2"
          />
        </label>
      )}

      <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {isDirty && !isBusy && (
          <p className="text-xs font-medium text-app-text-muted sm:mr-1">
            You have unsaved changes
          </p>
        )}

        <SaveButton
          dirty={isDirty}
          saving={saveState === "loading"}
          disabled={loadState === "loading"}
          label={saveLabel}
          cleanLabel={saveLabel}
          onClick={() => {
            void saveSettings();
          }}
          className="w-full sm:w-auto"
        />
      </div>
    </div>
  );
}

type FormValues = {
  autoUpdate: boolean;
  scheduleType: ScheduleType;
  everyMinutes: string;
  time: string;
  daysOfWeek: GithubScheduleDayOfWeek[];
  dayOfMonth: string;
  cron: string;
};

const DEFAULT_FORM_VALUES: FormValues = {
  autoUpdate: true,
  scheduleType: "INTERVAL",
  everyMinutes: "60",
  time: "02:00:00",
  daysOfWeek: ["MONDAY"],
  dayOfMonth: "1",
  cron: "0 0 2 * * *",
};

/**
 * Projects a stored/initial config into the full set of form field values
 * (filling the fields the active schedule type does not use with defaults), so
 * the saved baseline is comparable to the live form for dirty detection.
 */
function toFormValues(
  autoUpdate: boolean,
  spec: GithubRepositoryConfig["spec"] | ConfigureGithubRepositoryRequest["schedule"],
): FormValues {
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

/** Stable string key for a set of form values (weekday order is irrelevant). */
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
function serializeFormValues(values: FormValues): string {
  const { autoUpdate, scheduleType } = values;

  switch (scheduleType) {
    case "INTERVAL":
      return JSON.stringify({
        autoUpdate,
        scheduleType,
        everyMinutes: values.everyMinutes,
      });
    case "DAILY":
      return JSON.stringify({
        autoUpdate,
        scheduleType,
        time: normalizeTimeInput(values.time),
      });
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

function toggleDay(selectedDays: GithubScheduleDayOfWeek[], day: GithubScheduleDayOfWeek) {
  if (selectedDays.includes(day)) {
    return selectedDays.filter((selectedDay) => selectedDay !== day);
  }

  return [...selectedDays, day];
}

function formatDayLabel(day: GithubScheduleDayOfWeek) {
  return day
    .slice(0, 3)
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}
