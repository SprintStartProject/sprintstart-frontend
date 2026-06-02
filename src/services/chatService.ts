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

export async function getChats() {
    const res = await fetch(`api/v1/chats`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json() as Promise<{ chats: Chat[] }>;
}

export async function createChat(userId: string) {
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
            );

            switch (event.type) {
                case "token":
                    handlers.onToken(event.content);
                    break;

                case "citation":
                    handlers.onCitation(event);
                    break;

                case "done":
                    handlers.onDone();
                    return;

                case "error":
                    handlers.onError?.(event.message);
                    return;
            }
        }
    }

    // Fallback: Ensure onDone is called when the stream ends naturally
    handlers.onDone();
}