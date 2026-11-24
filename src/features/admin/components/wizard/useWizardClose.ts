import { useState } from "react";
import type { WizardPhase } from "./wizardRules";

type CloseInput = {
  phase: WizardPhase;
  /** Whether a close would throw away drafted work. */
  isDirty: boolean;
  isSubmitting: boolean;
  /** Empties the wizard and sends it back to the first step. */
  reset: () => void;
  onClose: () => void;
};

type WizardClose = {
  /** Guards the "discard unsaved work?" confirmation over a dirty wizard. */
  confirmingClose: boolean;
  keepEditing: () => void;
  closeWizard: () => void;
  requestClose: () => void;
  confirmDiscard: () => void;
};

/**
 * Closing the wizard. Every dismissal path (backdrop, Escape, the header ✕, the footer Cancel) goes
 * through `requestClose`, so a dirty wizard asks before discarding. The provisioning screen is
 * exempt: the project already exists there, so closing just dismisses the status view.
 */
export function useWizardClose({
  phase,
  isDirty,
  isSubmitting,
  reset,
  onClose,
}: CloseInput): WizardClose {
  const [confirmingClose, setConfirmingClose] = useState(false);

  const closeWizard = () => {
    if (isSubmitting) return;

    reset();
    setConfirmingClose(false);
    onClose();
  };

  const requestClose = () => {
    if (isSubmitting) return;

    if (phase !== "provisioning" && isDirty) {
      setConfirmingClose(true);
      return;
    }

    closeWizard();
  };

  return {
    confirmingClose,
    keepEditing: () => setConfirmingClose(false),
    closeWizard,
    requestClose,
    confirmDiscard: () => {
      setConfirmingClose(false);
      closeWizard();
    },
  };
}
