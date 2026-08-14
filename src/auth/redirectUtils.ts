/**
 * Key used to persist the intended deep link URL across external OAuth/SSO redirects.
 */
export const AUTH_REDIRECT_STORAGE_KEY = "sprintstart_auth_redirect";

/**
 * Validates and sanitizes a candidate redirect path.
 *
 * Ensures that the path:
 * 1. Is a non-empty string.
 * 2. Is a relative path on the same origin (starts with a single `/`).
 * 3. Does NOT start with `//` or `/\\` (protocol-relative URLs).
 * 4. Does NOT contain URI schemes (e.g. `javascript:`, `data:`, `https:`).
 * 5. Does NOT point back to `/login`, in any casing or with a trailing slash
 *    (to prevent infinite redirect loops).
 *
 * @param raw - The candidate raw path string.
 * @returns The sanitized path if valid and safe, or `null` if invalid.
 */
export function sanitizeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // Must start with '/' but not '//' or '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }

  // Reject URLs containing protocol prefixes or backslashes before query/hash
  const pathWithoutQueryOrHash = trimmed.split(/[?#]/)[0];
  if (pathWithoutQueryOrHash.includes(":") || pathWithoutQueryOrHash.includes("\\")) {
    return null;
  }

  // Prevent redirecting back to the login page itself. The router matches routes
  // case-insensitively and tolerates a trailing slash, so "/Login" and "/login/"
  // reach the same page as "/login" and have to be rejected too -- otherwise an
  // authenticated user lands on the login page that no redirect rule applies to.
  const normalizedPath =
    pathWithoutQueryOrHash.length > 1
      ? pathWithoutQueryOrHash.replace(/\/+$/, "").toLowerCase()
      : pathWithoutQueryOrHash.toLowerCase();
  if (normalizedPath === "/login") {
    return null;
  }

  return trimmed;
}

/**
 * Extracts the full relative path including search params and hash from a location-like object.
 *
 * @param location - The location object containing pathname, optional search, and optional hash.
 * @returns The full relative path string.
 */
export function extractFullPath(location: {
  pathname: string;
  search?: string;
  hash?: string;
}): string {
  const search = location.search || "";
  const hash = location.hash || "";
  return `${location.pathname}${search}${hash}`;
}

/**
 * Saves the intended redirect destination in `sessionStorage` for cross-redirect resilience.
 *
 * @param target - The destination path to store.
 */
export function storeRedirectTarget(target: string): void {
  const sanitized = sanitizeRedirectPath(target);
  if (!sanitized) return;

  try {
    sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, sanitized);
  } catch (error) {
    console.warn("Failed to store auth redirect target in sessionStorage:", error);
  }
}

/**
 * Retrieves the stored redirect destination from `sessionStorage` without clearing it.
 *
 * @returns The stored sanitized path, or `null` if none exists.
 */
export function retrieveRedirectTarget(): string | null {
  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    return sanitizeRedirectPath(raw);
  } catch {
    return null;
  }
}

/**
 * Retrieves and clears the stored redirect destination from `sessionStorage`.
 *
 * @returns The stored sanitized path, or `null` if none was set.
 */
export function retrieveAndClearRedirectTarget(): string | null {
  try {
    const raw = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    return sanitizeRedirectPath(raw);
  } catch {
    return null;
  }
}

/**
 * Clears the stored redirect destination from `sessionStorage`.
 */
export function clearRedirectTarget(): void {
  try {
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
  } catch {
    // Ignore storage clearing failures
  }
}

/**
 * Options for resolving the post-authentication redirect destination.
 */
export interface ResolveRedirectOptions {
  searchParams?: URLSearchParams | null;
  locationState?: unknown;
  sessionTarget?: string | null;
  fallback?: string;
}

/**
 * Resolves the final destination path using the highest priority valid source available.
 *
 * Priority order:
 * 1. `searchParams` query parameter (`?redirect=` or `?from=`)
 * 2. `locationState.from` (object with pathname/search/hash or string)
 * 3. Stored `sessionStorage` target
 * 4. Safe fallback route (defaults to `"/"`)
 *
 * @param options - The input sources for the redirect destination.
 * @returns A sanitized, safe relative path.
 */
export function resolveRedirectTarget(options: ResolveRedirectOptions): string {
  const { searchParams, locationState, sessionTarget, fallback = "/" } = options;

  // 1. Check query parameter ?redirect= or ?from=
  if (searchParams) {
    const param = searchParams.get("redirect") || searchParams.get("from");
    const sanitizedParam = sanitizeRedirectPath(param);
    if (sanitizedParam) {
      return sanitizedParam;
    }
  }

  // 2. Check location state
  if (locationState && typeof locationState === "object" && "from" in locationState) {
    const fromVal = locationState.from;
    if (typeof fromVal === "string") {
      const sanitized = sanitizeRedirectPath(fromVal);
      if (sanitized) return sanitized;
    } else if (fromVal && typeof fromVal === "object" && "pathname" in fromVal) {
      const locObj = fromVal as { pathname: string; search?: string; hash?: string };
      const full = extractFullPath(locObj);
      const sanitized = sanitizeRedirectPath(full);
      if (sanitized) return sanitized;
    }
  }

  // 3. Check sessionStorage target
  if (sessionTarget) {
    const sanitizedSession = sanitizeRedirectPath(sessionTarget);
    if (sanitizedSession) {
      return sanitizedSession;
    }
  }

  // 4. Safe fallback
  return sanitizeRedirectPath(fallback) || "/";
}

/**
 * Constructs a full absolute redirect URI from a relative target path on the current origin.
 * Automatically removes any URL hash fragment to maintain strict OAuth 2.0 (RFC 6749 §3.1.2) compliance.
 *
 * @param targetPath - The relative target path (e.g. `/insights/faq/42?tab=1#sec`).
 * @returns The full URL without hash fragment (e.g. `http://localhost:5173/insights/faq/42?tab=1`).
 */
export function buildRedirectUri(targetPath?: string): string {
  if (!targetPath) {
    return `${window.location.origin}/`;
  }
  const sanitized = sanitizeRedirectPath(targetPath) || "/";
  const pathWithoutHash = sanitized.split("#")[0] || "/";
  return `${window.location.origin}${pathWithoutHash}`;
}
