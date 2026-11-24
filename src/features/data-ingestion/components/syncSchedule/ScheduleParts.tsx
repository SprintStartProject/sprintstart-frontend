import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { AccountEnabledToggle } from "../../../../components/ui/AccountEnabledToggle.tsx";
import { IconTile } from "../../../../components/ui/IconTile";
import { SaveButton } from "../../../../components/ui/SaveButton.tsx";
import { formatDateTime } from "../../data.ts";

/** A warning line: the inline load failure and the caller's disclaimer share this look. */
export function ScheduleNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm font-medium text-app-warning-text">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function NextSyncRow({ nextSyncAt }: { nextSyncAt: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-app-text">Next sync</p>
      <span className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-bg-soft px-3 py-1.5 text-xs font-semibold text-app-text">
        <CalendarClock className="h-3.5 w-3.5 text-app-text-muted" />
        {nextSyncAt ? formatDateTime(nextSyncAt) : "Not available"}
      </span>
    </div>
  );
}

type AutoUpdateCardProps = {
  enabled: boolean;
  disabled: boolean;
  onText: string;
  offText: string;
  ariaLabel: string;
  onChange: (enabled: boolean) => void;
};

/** Auto-update as a distinct switch card, set apart from the schedule fields below it. */
export function AutoUpdateCard({
  enabled,
  disabled,
  onText,
  offText,
  ariaLabel,
  onChange,
}: AutoUpdateCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-app-border bg-app-surface-muted p-4">
      <div className="flex min-w-0 items-start gap-3">
        <IconTile icon={RefreshCw} size="lg" tone="neutral" />

        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-text">Auto update</p>
          <p className="mt-1 text-xs text-app-text-muted">{enabled ? onText : offText}</p>
        </div>
      </div>

      <AccountEnabledToggle
        enabled={enabled}
        disabled={disabled}
        ariaLabel={ariaLabel}
        onChange={onChange}
      />
    </div>
  );
}

type ScheduleSaveBarProps = {
  isBusy: boolean;
  isDirty: boolean;
  saving: boolean;
  loading: boolean;
  label: string;
  onSave: () => void;
};

/** Like the admin drawers: the save affordance only appears once the form is dirty. */
export function ScheduleSaveBar({
  isBusy,
  isDirty,
  saving,
  loading,
  label,
  onSave,
}: ScheduleSaveBarProps) {
  if (!isDirty && !saving) return null;

  return (
    <div className="flex flex-col items-stretch gap-2 border-t border-app-border pt-4 sm:flex-row sm:items-center sm:justify-end">
      {!isBusy && (
        <p className="text-xs font-medium text-app-text-muted sm:mr-1">You have unsaved changes</p>
      )}

      <SaveButton
        dirty={isDirty}
        saving={saving}
        disabled={loading}
        label={label}
        cleanLabel={label}
        onClick={onSave}
        className="w-full sm:w-auto"
      />
    </div>
  );
}
