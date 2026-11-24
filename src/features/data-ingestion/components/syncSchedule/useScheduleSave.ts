import { useState } from "react";
import { useToast } from "../../../../context/useToast.ts";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../../services/sources/syncSchedule.ts";
import { buildScheduleSpec } from "./scheduleForm";
import type { ScheduleFormState } from "./useScheduleFormState";
import type { ScheduleLoad } from "./useScheduleLoad";

type SaveInput = {
  state: ScheduleFormState;
  load: ScheduleLoad;
  loadConfig?: () => Promise<SyncScheduleConfig>;
  onSave: (request: SyncScheduleRequest) => Promise<void>;
};

export type ScheduleSave = {
  saveState: "idle" | "loading" | "success" | "error";
  save: () => Promise<void>;
};

/**
 * Saves the form, takes it as the clean baseline, re-reads the config when there is a loader (the
 * server computes the next sync), and reports the outcome as a toast.
 */
export function useScheduleSave({ state, load, loadConfig, onSave }: SaveInput): ScheduleSave {
  const [saveState, setSaveState] = useState<ScheduleSave["saveState"]>("idle");
  const toast = useToast();

  const save = async () => {
    setSaveState("loading");

    try {
      const schedule = buildScheduleSpec(state.form);

      await onSave({ autoUpdate: state.form.autoUpdate, schedule });

      // The save succeeded, so the current values are now the clean baseline.
      state.markSaved(state.form.autoUpdate, schedule);

      if (loadConfig) load.applyLoaded(await loadConfig());

      setSaveState("success");
      toast.success("Sync settings saved");
    } catch (error) {
      setSaveState("error");
      toast.error(error instanceof Error ? error.message : "Couldn't save the sync settings.");
    }
  };

  return { saveState, save };
}
