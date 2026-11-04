import { useState } from "react";

/**
 * Runs a navigation that leaves the drawer (a member, the way back, Data Ingestion, a source). The
 * drawer is replaced or the page changes, which drops the staged edits, so with changes pending it
 * asks first.
 */
export function useLeaveGuard(hasPendingChanges: boolean, discardChanges: () => void) {
  // A navigation out of the drawer, held while the unsaved-changes dialog asks.
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const leaveDrawer = (navigate: () => void) => {
    if (!hasPendingChanges) {
      navigate();
      return;
    }

    setPendingNavigation(() => navigate);
  };

  const confirmLeave = () => {
    const navigate = pendingNavigation;

    setPendingNavigation(null);
    discardChanges();
    navigate?.();
  };

  return {
    isAsking: pendingNavigation !== null,
    leaveDrawer,
    confirmLeave,
    keepEditing: () => setPendingNavigation(null),
  };
}
