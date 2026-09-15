import { useContext } from "react";
import { FocusModeContext, type FocusModeContextType } from "./FocusModeContext";

/**
 * Hook to read and set the app-wide focus mode.
 *
 * @returns The focus mode context, or an inert one when used outside the provider — a component
 * rendered on its own in a test should draw its "expand" button, not crash on it.
 */
export function useFocusMode(): FocusModeContextType {
  const context = useContext(FocusModeContext);
  if (context === undefined) {
    return { isFocused: false, setFocused: () => {}, toggleFocused: () => {} };
  }

  return context;
}
