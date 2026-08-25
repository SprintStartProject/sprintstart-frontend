import { apiClient } from "./apiClient";
import keycloak from "../config/keycloak";
import type { BuddyStreamHandlers } from "../features/buddy/types";
import type { BuddyMessage } from "../features/buddy/types";

/**
 * Retrieves the current visit's buddy messages, oldest first (the window since the mentor last
 * updated its memory — not the whole transcript).
 */
export async function getMessages(): Promise<BuddyMessage[]> {
  return await apiClient.fetch<BuddyMessage[]>(`/api/v1/onboarding/me/buddy/messages`);
}

/** One suggested next step attached to a buddy greeting — one click sends `question`. */
export interface BuddyOpeningAction {
  label: string;
  question: string;
}

/**
 * One thing this hire could usefully ask, offered as a chip beside the composer.
 *
 * `question` goes into the composer; it is never sent. The hire presses send. A chip that
 * spoke for somebody would be putting words in their mouth, which is the same rule `AskTheBuddy`
 * keeps for the board.
 */
export interface BuddySuggestion {
  label: string;
  question: string;
}

/**
 * What this hire could usefully ask, drawn server-side from the tools actually mounted for them —
 * so a chip is never offered for something their buddy cannot answer. Calls no model, so a surface
 * can show these before a greeting has arrived.
 */
export async function getSuggestions(): Promise<BuddySuggestion[]> {
  return await apiClient.fetch<BuddySuggestion[]>(`/api/v1/onboarding/me/buddy/suggestions`);
}

/** How a caller receives a visit's greeting as it is written. */
export interface BuddyOpeningHandlers {
  onToken: (token: string) => void;
  /** The one suggested next step, if the mentor offered one. Arrives before `onDone`. */
  onAction?: (action: BuddyOpeningAction) => void;
  onDone: () => void;
  onError?: (message: string) => void;
}

/**
 * Opens a buddy visit, streaming the greeting as the mentor writes it.
 *
 * The mentor greets the hire grounded in their durable memory and current state; the past
 * transcript is not replayed — a visit starts fresh with this greeting.
 *
 * The first token can still be tens of seconds away. The greeting is written before
 * anything the hire never sees, so nothing is queued behind invisible output — but the model is
 * remote and conditionally reasoning, and it emits nothing while it thinks. Handlers must treat a
 * long silence before the first token as normal, not as a failed stream.
 *
 * Opening twice without the hire saying anything is the same visit: the greeting already there is
 * replayed whole and no model is called.
 */
export async function streamOpenBuddy(handlers: BuddyOpeningHandlers): Promise<void> {
  const outcome = await readBuddyStream(
    `/api/v1/onboarding/me/buddy/open/stream`,
    undefined,
    (chunk) => {
      switch (chunk.type) {
        case "token":
          if (chunk.content !== undefined) handlers.onToken(chunk.content);
          break;
        case "opening_action":
          // Not an action proposal. `action_proposal` means the buddy is offering to *do*
          // something and is gated on the hire confirming; this only fills the composer.
          if (chunk.label && chunk.question) {
            handlers.onAction?.({ label: chunk.label, question: chunk.question });
          }
          break;
        case "done":
          handlers.onDone();
          return "stop";
        case "error":
          handlers.onError?.(chunk.message ?? "The buddy could not be reached.");
          return "stop";
      }
    },
    handlers.onError,
  );

  // The greeting is all there is here, so a body that ends without a terminal event still
  // finished it -- the page must stop waiting either way.
  if (outcome === "ended") handlers.onDone();
}

/**
 * Generic stream event returned by the backend when sending a buddy message. Mirrors
 * chatService's ChatEvent -- the backend's BuddyStreamEvent uses the identical shape
 * and wire field names as the chat module's AiStreamMessage.
 */
interface BuddyStreamChunk {
  type: "tool_use" | "token" | "citation" | "action_proposal" | "opening_action" | "done" | "error";
  content?: string;
  message?: string;
  name?: string;
  artifact_id?: string;
  filename?: string;
  source_url?: string;
  start_line?: number;
  start_page?: number;
  // Set only on an action_proposal chunk: the buddy is offering to do something, gated on confirm.
  action?: string;
  label?: string;
  question?: string;
  // Confirm payloads of the proposing action — echoed back verbatim on confirm
  // (as camelCase), so the target is the one the buddy proposed.
  task_id?: string;
  title?: string;
  attester_id?: string;
  github_login?: string;
  competency_key?: string;
  level?: string;
}

/** The outcome of confirming a buddy-proposed action — a single line to relay in the thread. */
export interface BuddyActionResult {
  ok: boolean;
  message: string;
}

/**
 * Confirms a buddy-proposed action. This is the only call that mutates — the proposal itself
 * changed nothing. The project is re-resolved server-side from the caller, so only the action name
 * and the proposal's own confirm payloads are sent: `question` for flag-to-PM, `taskId` for a
 * goal claim, `title` + `attesterId` for an attestation request, `githubLogin` for saving a
 * username, `competencyKey` + `level` for recording where a conversation placed the hire.
 */
export async function performAction(
  action: string,
  extras: {
    question?: string;
    taskId?: string;
    title?: string;
    attesterId?: string;
    githubLogin?: string;
    competencyKey?: string;
    level?: string;
  } = {},
): Promise<BuddyActionResult> {
  return await apiClient.fetch<BuddyActionResult>(`/api/v1/onboarding/me/buddy/actions`, {
    method: "POST",
    body: JSON.stringify({
      action,
      question: extras.question,
      taskId: extras.taskId,
      title: extras.title,
      attesterId: extras.attesterId,
      githubLogin: extras.githubLogin,
      competencyKey: extras.competencyKey,
      level: extras.level,
    }),
  });
}

/**
 * How a buddy stream finished.
 *
 * Three outcomes, not two, and the difference decides whether the caller announces completion.
 * `terminated` means the server said `done` or `error` and has already been reported. `ended` means
 * the body ran out with no terminal event, so the caller still owes its own `onDone`. `aborted`
 * means the request never produced a stream at all — the caller must not announce completion
 * there, because nothing was answered.
 */
type BuddyStreamOutcome = "terminated" | "ended" | "aborted";

/**
 * Reads one of the buddy's Server-Sent Event endpoints, handing each parsed chunk to `onChunk`.
 *
 * Extracted once there were two callers — sending a message and opening a visit — rather than in
 * advance: token refresh, the HTTP check, the `data:` framing and the buffered line split are
 * identical for both, and only the handling of each chunk differs.
 *
 * `onChunk` returns `"stop"` to end the read, which is how a terminal `done` or `error` closes the
 * stream without every caller writing its own loop exit.
 */
async function readBuddyStream(
  path: string,
  body: unknown,
  onChunk: (chunk: BuddyStreamChunk) => "stop" | void,
  onError?: (message: string) => void,
): Promise<BuddyStreamOutcome> {
  // Ensure the token is up to date (refresh if it expires in < 30s)
  try {
    if (keycloak.authenticated) {
      await keycloak.updateToken(30);
    }
  } catch (error) {
    console.error("Failed to refresh Keycloak token for buddy stream", error);
    void keycloak.login();
    return "aborted";
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keycloak.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Reported rather than thrown, so "we never reached the server" arrives at the caller's
    // error surface as a sentence instead of as a rejection it has to translate. The only thing
    // the hire needs from this is whether trying again is worth it.
    onError?.("Could not reach the server.");
    return "aborted";
  }

  if (!res.ok) {
    onError?.(`HTTP error! status: ${res.status}`);
    return "aborted";
  }

  const reader = res.body?.getReader();

  if (!reader) {
    // Reported like every other failure here rather than thrown: a caller that wired up
    // `onError` should not also have to wrap the call.
    onError?.("No response stream.");
    return "aborted";
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        let event: BuddyStreamChunk;
        try {
          event = JSON.parse(line.replace("data:", "").trim()) as BuddyStreamChunk;
        } catch {
          // A malformed chunk is skipped, never fatal -- the same tolerance the backend applies,
          // and what `aiStreamService` already does with the identical framing. One unparseable
          // line (a keep-alive, a proxy's own text, a truncated tail) used to throw out of the
          // loop and take the rest of the reply with it.
          continue;
        }

        if (onChunk(event) === "stop") {
          // The caller is finished with this stream, so let go of the body rather than leaving
          // an open connection for the collector to notice eventually.
          void reader.cancel();
          return "terminated";
        }
      }
    }
  } catch (error) {
    // A connection dropped mid-stream. Without this it rejected out of the function, past every
    // `onError` the caller wired up, and whatever had streamed so far simply stopped.
    console.error("Buddy stream failed mid-response", error);
    onError?.("The connection to your buddy dropped.");
    return "aborted";
  }

  return "ended";
}

/**
 * Sends a message to the user's persistent buddy and streams the grounded reply.
 *
 * @param content The message to send.
 * @param handlers Helper operations handling the output of the buddy's response.
 */
export async function streamMessage(content: string, handlers: BuddyStreamHandlers): Promise<void> {
  const outcome = await readBuddyStream(
    `/api/v1/onboarding/me/buddy/messages`,
    { content },
    (event) => {
      switch (event.type) {
        case "tool_use":
          if (event.name) {
            handlers.onToolUse?.(event.name);
          }
          break;

        case "token":
          if (event.content !== undefined) {
            handlers.onToken(event.content);
          }
          break;

        case "citation":
          if (event.artifact_id && event.filename) {
            handlers.onCitation({
              artifactId: event.artifact_id,
              filename: event.filename,
              sourceUrl: event.source_url,
              startLine: event.start_line,
              startPage: event.start_page,
            });
          }
          break;

        case "action_proposal":
          if (event.action && event.label) {
            handlers.onActionProposal?.({
              action: event.action,
              label: event.label,
              question: event.question,
              taskId: event.task_id,
              title: event.title,
              attesterId: event.attester_id,
              githubLogin: event.github_login,
              competencyKey: event.competency_key,
              level: event.level,
            });
          }
          break;

        case "done":
          handlers.onDone();
          return "stop";

        case "error":
          handlers.onError?.(event.message ?? "Unknown error");
          return "stop";
      }
    },
    handlers.onError,
  );

  // Fallback: ensure onDone is called when the stream ends without a terminal event.
  if (outcome === "ended") handlers.onDone();
}
