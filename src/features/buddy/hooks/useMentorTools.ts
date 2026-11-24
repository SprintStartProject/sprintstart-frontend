import { useCallback, useEffect, useRef, useState } from "react";
import { readStoredMentorTools, writeStoredMentorTools } from "../conversation/buddyPreferences";

/**
 * Whether the mentor may act, remembered per signed-in user and on by default.
 *
 * Read again on every change of user, so a logout or account switch inherits nothing. The ref
 * mirrors the state for the streaming call, which reads it mid-turn.
 */
export function useMentorTools(userId: string | null) {
  const [capabilitiesEnabled, setEnabledState] = useState(true);
  const enabledRef = useRef(true);
  // Deferred to a microtask so setState never runs synchronously in the effect body.
  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      const stored = userId === null ? true : readStoredMentorTools(userId);
      setEnabledState(stored);
      enabledRef.current = stored;
    })();
  }, [userId]);

  const setCapabilitiesEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      enabledRef.current = next;
      if (userId !== null) writeStoredMentorTools(userId, next);
    },
    [userId],
  );

  /** The setting as it is right now, for the streaming call. */
  const capabilitiesNow = useCallback(() => enabledRef.current, []);

  return { capabilitiesEnabled, setCapabilitiesEnabled, capabilitiesNow };
}
