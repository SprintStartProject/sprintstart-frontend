import { ApiError } from "./apiClient";

/**
 * Extracts a human-readable message from a service error.
 *
 * `apiClient` has already unwrapped the backend's `{ message }`/`{ error }`
 * response body into `ApiError.message`, so that string is used directly. The
 * fallback is only returned when the message is empty (or the value isn't an
 * `ApiError` we can read), letting callers supply a context-specific default
 * (e.g. "failed to delete").
 */
export function parseApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
  }
  return error.message.trim() || fallback;
}

/**
 * A refetch-after-mutation failed: the mutation itself succeeded on the
 * server, but the list couldn't be reloaded. Surfaces a distinct message so
 * the UI can tell the user "saved, but couldn't refresh" rather than the
 * generic mutation-error text.
 */
export function describeRefreshFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : "Unknown error";
  return `Saved on the server, but the token list couldn't be refreshed (${detail}). Click Refresh to retry.`;
}
