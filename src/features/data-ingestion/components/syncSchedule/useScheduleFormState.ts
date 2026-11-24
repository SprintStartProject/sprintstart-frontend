import { useCallback, useMemo, useState } from "react";
import type { SyncScheduleConfig } from "../../../../services/sources/syncSchedule.ts";
import {
  DEFAULT_FORM_VALUES,
  mergeSpec,
  serializeFormValues,
  toFormValues,
  type FormValues,
} from "./scheduleForm";

export type ScheduleFormState = {
  form: FormValues;
  patch: (change: Partial<FormValues>) => void;
  /** Takes a stored config as both the live form and the clean baseline. */
  adopt: (autoUpdate: boolean, spec: SyncScheduleConfig["spec"]) => void;
  /** Makes the given values the clean baseline without touching the live form. */
  markSaved: (autoUpdate: boolean, spec: SyncScheduleConfig["spec"]) => void;
  isDirty: boolean;
};

/**
 * The form values and the serialized snapshot of the last saved/loaded ones. Comparing the live form
 * against that baseline is how the Save button knows whether there are unsaved changes, so it can
 * stay muted until the user actually edits something.
 */
export function useScheduleFormState(): ScheduleFormState {
  const [form, setForm] = useState<FormValues>(DEFAULT_FORM_VALUES);
  const [baseline, setBaseline] = useState(() => serializeFormValues(DEFAULT_FORM_VALUES));

  const patch = useCallback((change: Partial<FormValues>) => {
    setForm((current) => ({ ...current, ...change }));
  }, []);

  const markSaved = useCallback((autoUpdate: boolean, spec: SyncScheduleConfig["spec"]) => {
    setBaseline(serializeFormValues(toFormValues(autoUpdate, spec)));
  }, []);

  const adopt = useCallback(
    (autoUpdate: boolean, spec: SyncScheduleConfig["spec"]) => {
      setForm((current) => mergeSpec({ ...current, autoUpdate }, spec));
      markSaved(autoUpdate, spec);
    },
    [markSaved],
  );

  const isDirty = useMemo(() => serializeFormValues(form) !== baseline, [form, baseline]);

  return { form, patch, adopt, markSaved, isDirty };
}
