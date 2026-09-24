import type { ReactNode } from "react";
import { useEffect, useState, useRef } from "react";
import { userService } from "../services/userService";
import type { UserProfile } from "../services/types";
import { AuthContext, type AuthStatus, type LoginOptions } from "./AuthContext";
import keycloak from "../config/keycloak";
import { queryClient } from "../services/queryClient";
import { clearSigningOut, markSigningOut } from "../bootSplash";
import { buildRedirectUri, clearRedirectTarget, storeRedirectTarget } from "../auth/redirectUtils";
/**
 * Provider component that manages the global authentication state via Keycloak.
 */
/**
 * Whether a URL fragment is an OIDC response rather than somebody's link to a heading.
 *
 * Keycloak puts its answer in the fragment -- `code`/`state` on success, `error` on refusal -- and
 * a spent one has to go, or the next reload resends it. Anything else is the page's own anchor.
 */
function isOidcResponseHash(hash: string): boolean {
  if (!hash || hash.length < 2) return false;
  const parameters = new URLSearchParams(hash.slice(1));
  return (
    parameters.has("code") ||
    parameters.has("state") ||
    parameters.has("error") ||
    parameters.has("session_state")
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // The boot script (index.html) detects a logout return, or a failed silent SSO check,
  // before React mounts and leaves this flag for the first render to pick up, so the guard
  // can keep that load blank instead of flashing its loading skeleton before settling into
  // authenticated/unauthenticated.
  const [status, setStatus] = useState<AuthStatus>(() =>
    window.__bootSigningOut ? "signingOut" : "loading",
  );
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
        const isLoginRequired =
          typeof error === "object" &&
          error !== null &&
          "error" in error &&
          error.error === "login_required";

        if (!isLoginRequired) {
          console.error("Keycloak initialization failed", error);
        }

        // A failed init leaves a spent authorization code sitting in the URL hash. Keycloak
        // only strips it on success, so a stray reload here would resend the same dead code
        // and fail identically, forever. Clearing it lets the next load start a clean flow.
        //
        // Only a hash that looks like one of those responses, though. This runs on the ordinary
        // `login_required` of a first visit too, and before `AuthGuard` mounts -- so clearing
        // every hash threw away the fragment of a shared deep link, and made the hash-restore
        // branch in `AuthGuard` unreachable.
        if (isOidcResponseHash(window.location.hash)) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }

        setStatus("unauthenticated");
      } finally {
        clearSigningOut();
      }
    };

    void initAuth();
  }, []);

  const login = async (options?: LoginOptions) => {
    let redirectUri = options?.redirectUri;
    if (!redirectUri && options?.redirectPath) {
      redirectUri = buildRedirectUri(options.redirectPath);
      storeRedirectTarget(options.redirectPath);
    }

    if (redirectUri) {
      await keycloak.login({ redirectUri });
    } else {
      await keycloak.login();
    }
  };

  const logout = async () => {
    // Keycloak's logout navigates the page out and back, and the load that
    // lands here afterwards looks exactly like a cold start. The note is
    // what stops the boot splash starting a launch for somebody leaving.
    markSigningOut();
    clearRedirectTarget();
    queryClient.clear();
    await keycloak.logout({ redirectUri: `${window.location.origin}/login` });
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
