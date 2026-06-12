import type {Chat, ChatMessage, Citation} from "../types/chatTypes.ts";

/**
 * Fetches all available chat conversations for the current session.
 * 
 * @returns A promise resolving to an object containing an array of Chat objects.
 * @throws Error if the backend request fails.
 */
export async function getChats() {
    const userId = localStorage.getItem('sprintstart_session_id');
    // --- TESTUSER BYPASS ---
    if (userId === 'test-user-id') {
        return {
            chats: [
                { id: 'chat-1', userId: 'test-user-id', title: 'Onboarding Help', createdAt: new Date().toISOString() }
            ]
        };
    }
    // -----------------------
    const res = await fetch(`/api/v1/chats`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json() as Promise<{ chats: Chat[] }>;
}

/**
 * Creates a new chat conversation for a specific user.
 * 
 * @param userId - The ID of the user starting the chat.
 * @returns A promise resolving to the newly created Chat object.
 * @throws Error if the chat creation fails.
 */
export async function createChat(userId: string) {
    // --- TESTUSER BYPASS ---
    if (userId === 'test-user-id' || userId === '00000000-0000-0000-0000-000000000001') {
        return {
            id: 'chat-1',
            userId: 'test-user-id',
            title: '',
            createdAt: new Date().toISOString()
        };
    }
    // -----------------------
    const res = await fetch(`/api/v1/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId
        })
    });
    return res.json() as Promise<Chat>;
}

/**
 * Retrieves all messages for a specific chat conversation.
 * 
 * @param chatId - The unique identifier of the chat.
 * @returns A promise resolving to an object containing an array of ChatMessage objects.
 * @throws Error if the messages cannot be loaded.
 */
export async function getMessages(chatId: string) {
    // --- TESTUSER BYPASS ---
    if (chatId === 'chat-1') {
        return { messages: [] };
    }
    // -----------------------
    const res = await fetch(`/api/v1/chats/${chatId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    })
    return res.json() as Promise<{ messages: ChatMessage[] }>
}

/**
 * Handlers for processing real-time streaming events from the AI.
 */
export type StreamHandlers = {
    /** Called for every new text token received from the LLM. */
    onToken: (token: string) => void;
    /** Called when the LLM provides a source citation for its response. */
    onCitation: (citation: Citation) => void;
    /** Called when the stream has successfully finished. */
    onDone: () => void;
    /** Optional handler for stream-specific errors. */
    onError?: (message: string) => void;
};

interface ChatEvent {
    type: "token" | "citation" | "done" | "error";
    content?: string;
    message?: string;
    chunk_id?: string;
    filename?: string;
    section_path?: string;
}

/**
 * Sends a message to the AI and streams the response in real-time.
 * 
 * This function handles Server-Sent Events (SSE) from the backend, parsing
 * tokens, citations, and status updates as they arrive.
 * 
 * @param chatId - The ID of the chat conversation.
 * @param text - The user's prompt or message.
 * @param handlers - A set of callbacks to handle different stream events.
 * @returns A promise that resolves once the stream processing is complete.
 * @throws Error if the stream cannot be established or the network fails.
 */
export async function streamMessage(
    chatId: string,
    text: string,
    handlers: StreamHandlers
): Promise<void> {
    const userId = localStorage.getItem('sprintstart_session_id');
    // --- TESTUSER BYPASS ---
    if (userId === 'test-user-id' || chatId === 'chat-1') {
        const tokens = ["I ", "can ", "help ", "with ", "that."];
        for (const token of tokens) {
            await new Promise(resolve => setTimeout(resolve, 50));
            handlers.onToken(token);
        }
        handlers.onCitation({
            chunk_id: 'chunk-1',
            filename: 'developer_guide.md',
            section_path: 'Setup'
        });
        handlers.onDone();
        return;
    }
    // -----------------------
    const res = await fetch(`/api/v1/chats/prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "chatId": chatId,
            "msg": text
        })
    });

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
                case "token":
                    if (event.content !== undefined) {
                        handlers.onToken(event.content);
                    }
                    break;

                case "citation":
                    if (event.chunk_id && event.filename) {
                        handlers.onCitation({
                            chunk_id: event.chunk_id,
                            filename: event.filename,
                            section_path: event.section_path ?? ""
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