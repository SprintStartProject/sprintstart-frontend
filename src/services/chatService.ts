import { apiClient } from "./apiClient";
import keycloak from "../config/keycloak";
import type { Chat, ChatMessage, StreamHandlers } from "../features/chatbot/types";

/**
 * Retrieves all created chats.
 *
 * @throws Error if the backend request fails
 */
export async function getChats() {
    const response = await apiClient.fetch<{ chats: Chat[] }>(`/api/v1/chats`);
    return response;
}

/**
 * Creates a new chat for a specific user.
 *
 * @param userId The user starting the conversation.
 */
export async function createChat(userId: string) {
    return await apiClient.fetch<Chat>(`/api/v1/chats`, {
        method: "POST",
        body: JSON.stringify({ userId }),
    });
}

/**
 * Retrieves all messages from a specific chat.
 *
 * @param chatId The chat the messages belong to.
 */
export async function getMessages(chatId: string) {
    return await apiClient.fetch<{ messages: ChatMessage[] }>(`/api/v1/chats/${chatId}`);
}

/**
 * Generic stream event returned by the backend when sending a prompt.
 */
interface ChatEvent {
    type: "tool_use" | "token" | "citation" | "done" | "error";
    name?: string;
    content?: string;
    message?: string;
    artifact_id?: string;
    filename?: string;
    source_url?: string;
    start_line?: number;
    start_page?: number;
}

/**
 * Creates a new prompt and handles the chat response.
 *
 * @param chatId The chat the prompt is created in.
 * @param text The content of the prompt.
 * @param sourceSystems The specified systems the AI may use to generate an answer.
 * @param from The start of the time period specifying when the documents used for generating the answer were uploaded.
 * @param to The end of the time period specifying when the documents used for generating the answer were uploaded.
 * @param handlers Helper operations handling the output of the chat response.
 */
export async function streamMessage(
    chatId: string,
    text: string,
    sourceSystems: string[],
    from: string,
    to: string,
    handlers: StreamHandlers
): Promise<void> {
    // Ensure the token is up to date (refresh if it expires in < 30s)
    try {
        if (keycloak.authenticated) {
            await keycloak.updateToken(30);
        }
    } catch (error) {
        console.error('Failed to refresh Keycloak token for stream', error);
        void keycloak.login();
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

    const res = await fetch(`/api/v1/chats/prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keycloak.token}`
        },
        body: JSON.stringify({
            "chatId": chatId,
            "msg": text,
            "filters": filters
        })
    });

    if (!res.ok) {
        handlers.onError?.(`HTTP error! status: ${res.status}`);
        return;
    }

    const reader = res.body?.getReader();

    if (!reader) {
        throw new Error("No response stream");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const event = JSON.parse(
                line.replace("data:", "").trim()
            ) as ChatEvent;

            switch (event.type) {
                case "tool_use":
                    if (event.name) {
                        handlers.onToolUse(event.name);
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
                            startPage: event.start_page
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
    }

    // Fallback: Ensure onDone is called when the stream ends naturally
    handlers.onDone();
}