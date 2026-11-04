import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs.tsx";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../services/sources/syncSchedule.ts";
import {
  AutoUpdateCard,
  NextSyncRow,
  ScheduleNotice,
  ScheduleSaveBar,
} from "./syncSchedule/ScheduleParts";
import { ScheduleFields } from "./syncSchedule/ScheduleFields";
import { SCHEDULE_TYPES } from "./syncSchedule/scheduleOptions";
import { useScheduleFormState } from "./syncSchedule/useScheduleFormState";
import { useScheduleLoad } from "./syncSchedule/useScheduleLoad";
import { useScheduleSave } from "./syncSchedule/useScheduleSave";

type SyncScheduleSettingsProps = {
  /** Reloads the form when it changes; pair it with `loadConfig`. */
  loadKey?: string;
  loadConfig?: () => Promise<SyncScheduleConfig>;
  initialConfig?: SyncScheduleRequest;
  onSave: (request: SyncScheduleRequest) => Promise<void>;
  disclaimer?: string;
  showNextSync?: boolean;
  autoUpdateOnText?: string;
  autoUpdateOffText?: string;
  toggleAriaLabel?: string;
  saveLabel?: string;
};

/**
 * Compact sync-schedule control shared by the project-wide modal and the source
 * details drawer of every connector. It intentionally exposes the day-to-day
 * knobs PMs need: whether due checks should perform an update, and the cadence.
 */
export function SyncScheduleSettings({
  loadKey,
  loadConfig,
  initialConfig,
  onSave,
  disclaimer,
  showNextSync = true,
  autoUpdateOnText = "Due checks update this source.",
  autoUpdateOffText = "Due checks only mark this source out of date.",
  toggleAriaLabel = "Toggle auto update",
  saveLabel = "Save",
}: SyncScheduleSettingsProps) {
  // Unique per mount: framer-motion matches `layoutId` globally, so the modal
  // and the details-panel copy of this form must not share the cadence pill.
  const cadenceLayoutId = useId();
  const prefersReducedMotion = useReducedMotion();
  const state = useScheduleFormState();
  const load = useScheduleLoad({ loadKey, loadConfig, initialConfig, adopt: state.adopt });
  const { saveState, save } = useScheduleSave({ state, load, loadConfig, onSave });
  const { form, patch, isDirty } = state;
  const isBusy = load.loadState === "loading" || saveState === "loading";

  // A quiet opacity crossfade between cadence field sets — deliberately not a
  // height/unfold reveal, which replayed an "expand" every time the schedule
  // type changed. Instant swap under reduced-motion.
  const fieldTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.15, ease: "easeOut" as const };

  return (
    // No own surface: this control renders both on the modal's `bg-app-bg` and
    // inside a Source Details `DrawerCard` (`bg-app-surface`); letting the parent
    // own the surface avoids a card-in-a-card look on either background.
    <div className="space-y-4">
      {load.errorMessage && <ScheduleNotice message={load.errorMessage} />}
      {disclaimer && <ScheduleNotice message={disclaimer} />}
      {showNextSync && <NextSyncRow nextSyncAt={load.nextSyncAt} />}

      <AutoUpdateCard
        enabled={form.autoUpdate}
        disabled={isBusy}
        onText={autoUpdateOnText}
        offText={autoUpdateOffText}
        ariaLabel={toggleAriaLabel}
        onChange={(autoUpdate) => patch({ autoUpdate })}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-app-text">Schedule</p>
        {/* SegmentedTabs has no disabled state; while busy we soft-disable the
            whole bar so the cadence can't change mid load/save. */}
        <div
          className={isBusy ? "pointer-events-none opacity-60" : undefined}
          aria-disabled={isBusy || undefined}
        >
          <SegmentedTabs
            value={form.scheduleType}
            options={SCHEDULE_TYPES}
            onChange={(scheduleType) => patch({ scheduleType })}
            layoutId={cadenceLayoutId}
            ariaLabel="Sync schedule cadence"
          />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={form.scheduleType}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fieldTransition}
        >
          <ScheduleFields form={form} disabled={isBusy} patch={patch} />
        </motion.div>
      </AnimatePresence>

      <ScheduleSaveBar
        isBusy={isBusy}
        isDirty={isDirty}
        saving={saveState === "loading"}
        loading={load.loadState === "loading"}
        label={saveLabel}
        onSave={() => void save()}
      />
    </div>
  );
}
