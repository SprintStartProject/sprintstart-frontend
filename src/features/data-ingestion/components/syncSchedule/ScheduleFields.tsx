import { useId } from "react";
import { Input } from "../../../../components/ui/Input.tsx";
import { Select } from "../../../../components/ui/Select.tsx";
import type { ScheduleDayOfWeek } from "../../../../services/sources/syncSchedule.ts";
import { formatDayLabel, toggleDay, type FormValues } from "./scheduleForm";
import { DAYS_OF_WEEK, intervalOptionsFor } from "./scheduleOptions";

type FieldProps = {
  form: FormValues;
  disabled: boolean;
  patch: (change: Partial<FormValues>) => void;
};

function IntervalField({ form, disabled, patch }: FieldProps) {
  const id = useId();
  return (
    <div className="max-w-xs">
      <label htmlFor={id} className="text-sm font-medium text-app-text">
        Every
      </label>
      <Select
        id={id}
        value={form.everyMinutes}
        disabled={disabled}
        onChange={(event) => patch({ everyMinutes: event.target.value })}
        className="mt-2"
      >
        {intervalOptionsFor(form.everyMinutes).map((minutes) => (
          <option key={minutes} value={String(minutes)}>
            {minutes} minutes
          </option>
        ))}
      </Select>
    </div>
  );
}

function TimeField({ form, disabled, patch, className }: FieldProps & { className: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={className}>
      <span className="text-sm font-medium text-app-text">Time</span>
      <Input
        id={id}
        type="time"
        step="1"
        value={form.time}
        disabled={disabled}
        onChange={(event) => patch({ time: event.target.value })}
        className="mt-2"
      />
    </label>
  );
}

function DayButton({
  day,
  selected,
  disabled,
  onToggle,
}: {
  day: ScheduleDayOfWeek;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-app-brand-border-strong bg-app-brand text-white"
          : "border-app-border bg-app-surface text-app-text-muted hover:text-app-text",
      ].join(" ")}
    >
      {formatDayLabel(day)}
    </button>
  );
}

function WeeklyFields(props: FieldProps) {
  const { form, disabled, patch } = props;
  return (
    <div className="space-y-4">
      <TimeField {...props} className="block max-w-xs" />

      <fieldset>
        <legend className="text-sm font-medium text-app-text">Days</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <DayButton
              key={day}
              day={day}
              selected={form.daysOfWeek.includes(day)}
              disabled={disabled}
              onToggle={() => patch({ daysOfWeek: toggleDay(form.daysOfWeek, day) })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function MonthlyFields(props: FieldProps) {
  const { form, disabled, patch } = props;
  const dayId = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TimeField {...props} className="block" />

      <label htmlFor={dayId} className="block">
        <span className="text-sm font-medium text-app-text">Day of month</span>
        <Input
          id={dayId}
          type="number"
          min="1"
          max="31"
          value={form.dayOfMonth}
          disabled={disabled}
          onChange={(event) => patch({ dayOfMonth: event.target.value })}
          className="mt-2"
        />
      </label>
    </div>
  );
}

function CustomField({ form, disabled, patch }: FieldProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-app-text">Cron</span>
      <Input
        id={id}
        type="text"
        value={form.cron}
        disabled={disabled}
        onChange={(event) => patch({ cron: event.target.value })}
        className="mt-2 font-mono"
      />
    </label>
  );
}

/** The inputs of the selected cadence — only that cadence's fields are on screen. */
export function ScheduleFields(props: FieldProps) {
  switch (props.form.scheduleType) {
    case "INTERVAL":
      return <IntervalField {...props} />;
    case "DAILY":
      return <TimeField {...props} className="block max-w-xs" />;
    case "WEEKLY":
      return <WeeklyFields {...props} />;
    case "MONTHLY":
      return <MonthlyFields {...props} />;
    case "CUSTOM":
      return <CustomField {...props} />;
  }
}
