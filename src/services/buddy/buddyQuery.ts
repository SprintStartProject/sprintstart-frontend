/**
 * Names the conversation a call is about, on the query string — the shape the read and open
 * endpoints take their target in.
 *
 * Hand-joined rather than `URLSearchParams.size`, and skipped parts are left out entirely:
 * an absent parameter is what the backend reads as "the caller's own conversation".
 */
export function buddyQuery(parts: { sessionId?: string; teamProjectId?: string }): string {
  const params: string[] = [];

  if (parts.sessionId) params.push(`sessionId=${encodeURIComponent(parts.sessionId)}`);
  if (parts.teamProjectId) params.push(`teamProjectId=${encodeURIComponent(parts.teamProjectId)}`);

  return params.length > 0 ? `?${params.join("&")}` : "";
}
