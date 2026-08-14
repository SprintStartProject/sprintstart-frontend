import { createContext } from "react";
import type { UserProfile } from "../services/types";

/**
 * Represents the current authentication state of the application.
 */
export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

/**
 * Options for configuring the login flow.
 */
export interface LoginOptions {
  /** Optional relative path to return to after authentication (e.g. "/chat" or "/insights/faq/42?tab=1"). */
  redirectPath?: string;
  /** Optional absolute URI to return to after authentication. Takes precedence over redirectPath. */
  redirectUri?: string;
}

/**
 * Shape of the authentication context.
 */
export interface AuthContextType {
  /** Current state of authentication (e.g., loading, logged in, logged out). */
  status: AuthStatus;
  /** The authenticated user's profile metadata, or null if not logged in. */
  profile: UserProfile | null;
  /** Triggers the login flow and creates a session. */
  login: (options?: LoginOptions) => Promise<void>;
  /** Ends the current session and clears local credentials. */
  logout: () => Promise<void>;
  /** Force-refreshes the user profile from the backend. */
  refetchProfile: () => Promise<void>;
}

/**
 * Context for managing and accessing global authentication state.
 * Should be accessed via the `useAuth` hook.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
