import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FocusModeContext } from "./FocusModeContext";

/**
 * Holds the focus mode flag for the whole app.
 *
 * Not persisted, on purpose. Focus mode is a posture somebody takes for a stretch of work, not a
 * setting they configure — and a person who lands on the board days later with no sidebar and no
 * header, having forgotten they ever turned it on, has lost the app rather than gained the board.
 * Every visit starts with the shell in place.
 *
 * Pages are expected to clear it when they unmount; the shell does not, because it cannot know
 * whether a route change is away from the focused page or within it.
 */
export function FocusModeProvider({ children }: { children: ReactNode }) {
  const [isFocused, setIsFocused] = useState(false);

  const setFocused = useCallback((focused: boolean) => setIsFocused(focused), []);
  const toggleFocused = useCallback(() => setIsFocused((current) => !current), []);

  const value = useMemo(
    () => ({ isFocused, setFocused, toggleFocused }),
    [isFocused, setFocused, toggleFocused],
  );

  return <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>;
}
