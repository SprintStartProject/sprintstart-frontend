import { useContext } from "react";
import { ChatPreferencesContext } from "./ChatPreferencesContext";

/**
 * Hook to access the global chat display preferences.
 *
 * @returns The chat preferences context value.
 * @throws Error if used outside of a ChatPreferencesProvider.
 */
export function useChatPreferences() {
  const context = useContext(ChatPreferencesContext);
  if (context === undefined) {
    throw new Error("useChatPreferences must be used within a ChatPreferencesProvider");
  }
  return context;
}
