import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    createChat,
    getChats,
    getMessages,
    streamMessage
} from "../services/chatService";

import type { Chat, ChatMessage, Citation } from "../types/chatTypes";

type MessagesByChat = Record<string, ChatMessage[]>;

export function useChat() {
    const { id: chatId } = useParams();
    const navigate = useNavigate();

    const [chats, setChats] = useState<Chat[]>([]);
    const [messagesByChat, setMessagesByChat] = useState<MessagesByChat>({});
    const [isThinking, setIsThinking] = useState(false);
    const [newRequest, setNewRequest] = useState("");
    const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

    useEffect(() => {
        void (async () => {
            const data = await getChats();
            setChats(data.chats);
        })();
    }, []);

    useEffect(() => {
        if (!chatId) return;

        if (messagesByChat[chatId]) return;

        void (async () => {
            const data = await getMessages(chatId);

            setMessagesByChat(prev => ({
                ...prev,
                [chatId]: data.messages
            }));
        })();
    }, [chatId]);

    const messages = useMemo(() => {
        if (!chatId) return [];
        return messagesByChat[chatId] ?? [];
    }, [messagesByChat, chatId]);

    const refreshChats = async () => {
        const data = await getChats();
        setChats(data.chats);
    };

    const addMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        let currentChatId = chatId;

        // create new chat if needed
        if (!currentChatId) {
            const newChat = await createChat("00000000-0000-0000-0000-000000000001");

            // setChats(prev => [newChat, ...prev]); // TODO: ask team what they prefer

            currentChatId = newChat.id;

            await navigate(`/chat/${newChat.id}`);
        }

        setMessagesByChat(prev => ({
            ...prev,
            [currentChatId]: prev[currentChatId] ?? []
        }));

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "USER",
            chat: chats.find(chat => chat.id === currentChatId),
            content: text
        };

        const assistantId = crypto.randomUUID();

        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: "ASSISTANT",
            chat: chats.find(chat => chat.id === currentChatId),
            content: "",
            citations: [],
        };

        // optimistic update
        setMessagesByChat(prev => ({
            ...prev,
            [currentChatId]: [
                ...(prev[currentChatId] ?? []),
                userMessage,
                assistantMessage
            ]
        }));

        setIsThinking(true);

        try {
            await streamMessage(currentChatId, text, {
                onToken: token => {
                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? { ...m, content: m.content + token }
                                : m
                        )
                    }));
                },

                onCitation: citation => {
                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? {
                                    ...m,
                                    citations: [...(m.citations ?? []), citation]
                                }
                                : m
                        )
                    }));
                },

                onDone: () => {
                    setIsThinking(false);

                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? { ...m, isStreaming: false }
                                : m
                        )
                    }));

                    void refreshChats();
                },

                onError: err => {
                    console.error(err);
                    setIsThinking(false);
                }
            });
        } catch (e) {
            console.error(e);
            setIsThinking(false);
        }
    }, [chatId, navigate]);

    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!newRequest.trim()) return;

        void addMessage(newRequest);
        setNewRequest("");
    }, [newRequest, addMessage]);

    const activeChat = useMemo(() => {
        if (!chatId) return null;
        return chats.find(c => c.id === chatId) ?? null;
    }, [chats, chatId]);

    return {
        chats,
        chatId,
        activeChat,

        messages,

        handleSubmit,
        addMessage,

        newRequest,
        setNewRequest,

        isThinking,

        selectedCitation,
        setSelectedCitation
    };
}