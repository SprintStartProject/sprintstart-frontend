import { ApiError } from "./apiClient";

/**
 * Extracts a human-readable message from a service error.
 *
 * `ApiError.message` is the raw response body (text or JSON). When the body
 * is JSON with a `message` field, that field is used; otherwise the fallback
 * is returned so callers can supply a context-specific default (e.g. a PAT
 * format hint vs. a generic "failed to delete").
 */
export function parseApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "An unexpected error occurred.";
  }
  try {
    const body = JSON.parse(error.message) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // Body wasn't JSON — fall through to the caller-provided fallback.
  }
  return fallback;
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
