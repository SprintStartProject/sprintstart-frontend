import keycloak from "../config/keycloak";

/**
 * One chunk of an AI generation's live progress — the frontend view of the backend's
 * `AiProgressEvent` (Seam 1 of the live-AI-visibility initiative).
 *
 * `result` is opaque here: the surface re-reads its normal endpoint on `done` for the authoritative
 * artifact rather than reconstructing it from `result`. `item` carries the finalized element as a
 * loosely-typed bag — most surfaces only show its `label`, but the ones that assemble live (the
 * competency graph) read its fields to draw each node/edge as it lands. Its keys are snake_case
 * because the backend relays the AI's own payload untouched (same wire convention as the buddy).
 */
export type AiProgressItem = Record<string, unknown>;

export type AiProgressEvent = {
  type: "stage" | "item" | "warning" | "done" | "error";
  operation?: string;
  seq?: number;
  label?: string;
  stage?: string;
  message?: string;
  item?: AiProgressItem;
};

export type AiStreamHandlers = {
  onEvent: (event: AiProgressEvent) => void;
  /** The stream ended normally (a `done` event, or the connection closing after one). */
  onDone: () => void;
  /** A terminal `error` event, a non-OK response, or a transport failure. */
  onError: (message: string) => void;
};

/**
 * POSTs to an SSE progress endpoint and dispatches each `AiProgressEvent` to [handlers].
 *
 * Mirrors `buddyService.streamMessage`'s fetch + reader loop — the one SSE-over-fetch pattern this
 * app uses — generalised over the progress-event shape. The stream is a *view*: a caller shows the
 * events live, then re-reads its normal endpoint on `onDone` for the settled result. On any failure
 * the caller falls back to that same non-streaming read, so a dropped stream never costs the result.
 *
 * @param endpoint The `…/stream` endpoint (relative path), already carrying its query string.
 */
export async function streamAiProgress(
  endpoint: string,
  handlers: AiStreamHandlers,
): Promise<void> {
  try {
    if (keycloak.authenticated) {
      await keycloak.updateToken(30);
    }
  } catch (error) {
    console.error("Failed to refresh Keycloak token for AI progress stream", error);
    handlers.onError("Your session expired. Please reload.");
    return;
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
  } catch {
    handlers.onError("Could not reach the server.");
    return;
  }

  if (!res.ok) {
    handlers.onError(`HTTP error! status: ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    handlers.onError("No response stream.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  // The read loop is inside the guard for the same reason the fetch is: a connection dropped
  // mid-stream used to reject out of this function, past `onError` and past the caller, which
  // meant the documented fallback -- re-read the normal endpoint on failure -- never ran. The
  // caller sat in its loading state instead, because nothing had told it anything went wrong.
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        let event: AiProgressEvent;
        try {
          event = JSON.parse(line.replace("data:", "").trim()) as AiProgressEvent;
        } catch {
          // A malformed chunk is skipped, never fatal — same tolerance the backend applies.
          continue;
        }

        // Terminal events have dedicated callbacks; only progress events flow through onEvent.
        // Both let go of the body on the way out rather than leaving the connection open.
        if (event.type === "done") {
          void reader.cancel();
          handlers.onDone();
          return;
        }
        if (event.type === "error") {
          void reader.cancel();
          handlers.onError(event.message ?? "The AI service reported an error.");
          return;
        }
        handlers.onEvent(event);
      }
    }
  } catch (error) {
    console.error("AI progress stream failed mid-response", error);
    handlers.onError("The connection dropped before the run finished.");
    return;
  }

  // The stream closed without an explicit terminal event: treat it as done rather than an error,
  // and let the caller's re-read decide what actually landed.
  handlers.onDone();
}
