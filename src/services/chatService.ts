import { apiClient } from "./apiClient";
import { parseSSEStream } from "./sse";
import keycloak from "../config/keycloak";
import type { Chat, ChatMessage, StreamHandlers } from "../features/chatbot/types";

/**
 * Retrieves created chats for the current user (personal `/me` endpoint).
 *
 * @throws Error if the backend request fails
 */
export async function getMyChats() {
  const response = await apiClient.fetch<{ chats: Chat[] }>(`/api/v1/chats/me`);
  return response;
}

/**
 * Creates a new chat for the authenticated user.
 *
 * @param _userId Ignored parameter kept for signature compatibility (owner derived from JWT).
 * @returns The backend returns `{ id }`.
 */
export async function createChat(_userId?: string) {
  return await apiClient.fetch<{ id: string }>(`/api/v1/chats/me`, {
    method: "POST",
  });
}

/**
 * Retrieves all messages from a specific chat owned by the authenticated user.
 *
 * @param chatId The chat the messages belong to.
 * @note The backend's `ChatMessageResponse` omits `id` — we generate stable
 *   client-side ids here so React keys and the streaming-message tracking work.
 */
export async function getMessages(chatId: string) {
  const response = await apiClient.fetch<{ messages: ChatMessage[] }>(`/api/v1/chats/me/${chatId}`);
  return {
    messages: response.messages.map((msg) => ({
      ...msg,
      // Generate stable client-side ids so React keys work (backend
      // omits `id` on ChatMessageResponse).
      id: msg.id ?? crypto.randomUUID(),
      // G5: coerce null → undefined for optional citation fields so
      // downstream code only needs `!== undefined` guards, not both.
      citations: msg.citations?.map((c) => ({
        ...c,
        startLine: c.startLine ?? undefined,
        startPage: c.startPage ?? undefined,
        sourceUrl: c.sourceUrl ?? undefined,
      })),
    })),
  };
}

/**
 * Discriminated union for SSE events returned by the backend when sending a
 * prompt. Each variant carries exactly the fields its `type` needs, so the
 * `switch` in {@link streamMessage} is exhaustive and needs no `?.` guards.
 */
type ChatEvent =
  | { type: "tool_use"; name: string }
  | { type: "token"; content: string }
  | { type: "reasoning"; content: string }
  | {
      type: "citation";
      artifact_id: string;
      filename: string;
      source_url?: string;
      start_line?: number;
      start_page?: number;
    }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Creates a new prompt and handles the chat response.
 *
 * @param chatId The chat the prompt is created in.
 * @param text The content of the prompt.
 * @param sourceSystems The specified systems the AI may use to generate an answer.
 * @param from The start of the time period specifying when the documents used for generating the answer were uploaded.
 * @param to The end of the time period specifying when the documents used for generating the answer were uploaded.
 * @param handlers Helper operations handling the output of the chat response.
 * @param signal Optional `AbortSignal` — when aborted, the stream stops cleanly
 *   and `handlers.onDone` is called (partial content stays visible). Pass a
 *   signal from an `AbortController` to implement a "Stop" button.
 */
export async function streamMessage(
  chatId: string,
  text: string,
  sourceSystems: string[],
  from: string,
  to: string,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  // Ensure the token is up to date (refresh if it expires in < 30s)
  try {
    if (keycloak.authenticated) {
      await keycloak.updateToken(30);
    }
  } catch (error) {
    console.error("Failed to refresh Keycloak token for stream", error);
    handlers.onError?.("Authentication expired. Please log in again.");
    return;
  }

  if (!keycloak.token) {
    handlers.onError?.("Not authenticated. Please log in again.");
    return;
  }

  const filters =
    sourceSystems.length || from || to
      ? {
          sourceSystems: sourceSystems.length ? sourceSystems : undefined,
          from: from ? `${from}T00:00:00Z` : undefined,
          to: to ? `${to}T23:59:59Z` : undefined,
        }
      : undefined;

  const res = await fetch(`/api/v1/chats/me/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${keycloak.token}`,
    },
    body: JSON.stringify({
      chatId: chatId,
      msg: text,
      filters: filters,
    }),
    signal,
  });

  if (!res.ok) {
    handlers.onError?.(`HTTP error! status: ${res.status}`);
    return;
  }

  const stream = res.body;

  if (!stream) {
    handlers.onError?.("No response stream from server.");
    return;
  }

  try {
    for await (const event of parseSSEStream<ChatEvent>(stream)) {
      switch (event.type) {
        case "tool_use":
          if (event.name) {
            handlers.onToolUse(event.name);
          }
          break;

        case "reasoning":
          if (event.content !== undefined) {
            handlers.onReasoning(event.content);
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

        case "done":
          handlers.onDone();
          return;

        case "error":
          handlers.onError?.(event.message ?? "Unknown error");
          return;
      }
    }

    // Fallback: Ensure onDone is called when the stream ends naturally
    handlers.onDone();
  } catch (err) {
    // AbortError: the user clicked Stop — treat as a clean end, not an error.
    if (err instanceof Error && err.name === "AbortError") {
      handlers.onDone();
      return;
    }
    // Network drop or unexpected reader error: surface to the user, don't
    // re-throw so the provider's catch block never sees a stray error.
    console.error("Chat stream failed", err);
    handlers.onError?.(err instanceof Error ? err.message : "Connection lost during streaming.");
  }
}
