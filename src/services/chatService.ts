export type Chat = {
    id: string;
    title: string;
    userId: string;
    createdAt: string;
};

export type ChatMessage = {
    id: string;
    role: 'ASSISTANT' | 'USER' | 'SYSTEM' | 'ORCHESTRATOR';
    chatId: string,
    content: string;
    citations?: Citation[]
}

export type Citation = {
    chunk_id: string,
    filename: string,
    section_path: string
}

const SESSION_KEY = 'sprintstart_session_id';

export async function getChats() {
    // --- TESTUSER BYPASS ---
    const userId = localStorage.getItem(SESSION_KEY);
    if (userId === 'test-user-id') {
        return { chats: [{ id: 'chat-1', title: 'Test Conversation', userId: 'test-user-id', createdAt: new Date().toISOString() }] };
    }
    // -----------------------
    const res = await fetch(`api/v1/chats`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json() as Promise<{ chats: Chat[] }>;
}

export async function createChat(userId: string) {
    // --- TESTUSER BYPASS ---
    if (userId === 'test-user-id') {
        return { id: 'chat-new', title: 'New Test Chat', userId: 'test-user-id', createdAt: new Date().toISOString() };
    }
    // -----------------------
    const res = await fetch(`api/v1/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId
        })
    });
    return res.json() as Promise<Chat>;
}

export async function getMessages(chatId: string) {
    // --- TESTUSER BYPASS ---
    if (chatId.startsWith('chat-')) {
        return { messages: [{ id: 'msg-1', role: 'ASSISTANT', chatId, content: 'Hello! I am the mock assistant. How can I help you today?' }] };
    }
    // -----------------------
    const res = await fetch(`/api/v1/chats/${chatId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    })
    return res.json() as Promise<{ messages: ChatMessage[] }>
}

export type StreamHandlers = {
    onToken: (token: string) => void;
    onCitation: (citation: Citation) => void;
    onDone: () => void;
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

export async function streamMessage(
    chatId: string,
    text: string,
    handlers: StreamHandlers
): Promise<void> {
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