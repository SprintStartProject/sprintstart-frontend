import { createContext } from "react";

/**
 * User-facing chat display preferences. These are client-side only and
 * persisted to localStorage; they do not affect what the backend streams,
 * only what the UI renders.
 */
export interface ChatPreferences {
  /** Whether the "Thought Process" reasoning block is shown above each assistant message. */
  showThoughtProcess: boolean;
  /** Toggles the Thought Process visibility (persisted). */
  setShowThoughtProcess: (value: boolean) => void;
}

/**
 * Context for chat display preferences. Access via the {@link useChatPreferences} hook.
 */
export const ChatPreferencesContext = createContext<ChatPreferences | undefined>(undefined);
