import { ApiError } from "../../../../services/apiClient";
import { parseApiError } from "../../../../services/apiError";

/**
 * Turns a failed Notion credential call into a message for a toast. The
 * backend answers 401 when Notion rejects the integration token, 409 when the
 * credential name is taken and 502 when Notion cannot be reached; everything
 * else falls back to the server message or the caller's default.
 */
export function describeNotionCredentialError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Notion rejected this token. Check that it is the integration's internal secret.";
    }
    if (error.status === 409) {
      return "A Notion credential with this name already exists.";
    }
    if (error.status === 502) {
      return "Notion could not be reached. Try again in a moment.";
    }
  }
  return parseApiError(error, fallback);
}
