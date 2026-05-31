export type Chat = {
    id: string;
    title: string;
    userId: string;
    createdAt: string;
    messages: ChatMessage[];
};

export type ChatMessage = {
    id: string;
    role: 'AI' | 'USER' | 'SYSTEM' | 'ORCHESTRATOR';
    chat: Chat;
    content: string;
    createdAt: string;
}

export async function getChats() {
    const res = await fetch(`api/v1/chats`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "limit": null
        })
    });
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json() as Promise<Chat[]>;
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
    const res = await fetch(`/api/chats/${chatId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "limit": null
        })
    })
    return res.json() as Promise<Chat>
}

export async function sendMessage(chatId: string, msg: string) {
    const res = await fetch(`api/chats/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chatId,
            msg
        })
    });
    return res.json() as Promise<ChatMessage[]>;
}