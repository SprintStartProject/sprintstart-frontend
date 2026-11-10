import { useEffect, useState } from "react";
import { POLLING_WINDOW_MS } from "./ingestionRules";

/**
 * The window after a connect or an update, in which the page keeps reloading so the run it just
 * started shows up. It closes once it has run its course.
 */
export function usePollingWindow() {
  // When the window opened; null while it is closed.
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === null) return undefined;

    const timeoutId = window.setTimeout(() => setStartedAt(null), POLLING_WINDOW_MS);

    return () => window.clearTimeout(timeoutId);
  }, [startedAt]);

  return { isOpen: startedAt !== null, open: () => setStartedAt(Date.now()) };
}
