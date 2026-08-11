import type { ReactNode } from "react";
import { useEffect, useState, useRef } from "react";
import { userService } from "../services/userService";
import type { UserProfile } from "../services/types";
import { AuthContext, type AuthStatus } from "./AuthContext";
import keycloak from "../config/keycloak";
import { markSigningOut } from "../bootSplash";
/**
 * Provider component that manages the global authentication state via Keycloak.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    /**
     * Initializes Keycloak and sets up the authentication status.
     */
    const initAuth = async () => {
      if (isInitialized.current) return;
      isInitialized.current = true;

      try {
        const authenticated = await keycloak.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          checkLoginIframe: false,
        });

        if (authenticated) {
          let data = await userService.getProfile();
          let retries = 0;
          const maxRetries = 5;
          const delayMs = 1000;

          while (!data && retries < maxRetries) {
            console.warn(
              `Profile not found, retrying in ${delayMs}ms... (${retries + 1}/${maxRetries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            data = await userService.getProfile();
            retries++;
          }

          if (data) {
            setProfile(data);
            setStatus("authenticated");
          } else {
            // User exists in Keycloak but not in Backend DB yet
            // In a real app, we might trigger a registration or show a setup page
            console.warn(
              "User authenticated in Keycloak but no profile found in backend after retries.",
            );
            setStatus("unauthenticated");
          }
        } else {
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("Keycloak initialization failed", error);
        setStatus("unauthenticated");
      }
    };

    void initAuth();
  }, []);

  const login = async () => {
    await keycloak.login();
  };

  const logout = async () => {
    // Keycloak's logout navigates the page out and back, and the load that
    // lands here afterwards looks exactly like a cold start. The note is
    // what stops the boot splash starting a launch for somebody leaving.
    markSigningOut();
    await keycloak.logout();
  };

  const refetchProfile = async () => {
    const data = await userService.getProfile();
    if (data) {
      setProfile(data);
    }
  };

  return (
    <AuthContext.Provider value={{ status, profile, login, logout, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
