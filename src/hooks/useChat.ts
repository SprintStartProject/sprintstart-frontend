import { useEffect, useState } from "react";
import {useNavigate, useParams} from "react-router-dom";
import {type Citation, createChat, getChats, getMessages, streamMessage} from "../services/chatService";
import type {Chat, ChatMessage} from "../services/chatService";

export function useChat() {
    const { id: chatId } = useParams();
    const navigate = useNavigate();

    const [chat, setChat] = useState<Chat | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [chats, setChats] = useState<Chat[]>([]);
    const [newRequest, setNewRequest] = useState('');

    useEffect(() => {
        const loadChats = async () => {
            const data = await getChats();
            setChats(data);
        };

        void loadChats();
    }, []);

    useEffect(() => {
        if (!chatId) return;

        getMessages(chatId).then(setChat).catch(console.error);
    }, [chatId]);

    const addMessage = async (text: string) => {
        if (!text.trim()) return;

        let currentChatId = chatId;

        // Create new chat if current chat contains no messages yet
        if (!currentChatId) {
            const newChat = await createChat("00000000-0000-0000-0000-000000000001") // TODO: Adapt for non-default user
            setChats(prev => [newChat, ...prev]);
            currentChatId = newChat.id;
            void navigate(`/chat/${newChat.id}`);
        }

        // Mock messages only for UI
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "USER",
            content: text
        }

        setChats(prev => {
            if (!prev) return [];

            return prev.map(chat =>
                chat.id === currentChatId
                    ? {
                        ...chat,
                        messages: [...chat.messages, userMessage]
                    }
                    : chat
            );
        });

        const assistantId = crypto.randomUUID();

        setChats(prev =>

            (prev ?? []).map(chat =>
                chat.id === currentChatId
                    ? {
                        ...chat,
                        messages: [
                            ...chat.messages,
                            {
                                id: assistantId,
                                role: "AI",
                                content: ""
                            }
                        ]
                    }
                    : chat
            )
        );

        setIsThinking(true);

        // Send request to backend
        try {
            await streamMessage(currentChatId, text, {
                onToken: token =>
                    appendToken(currentChatId!, assistantId, token),

                onCitation: citation =>
                    attachCitation(currentChatId!, assistantId, citation),

                onDone: () =>
                    finalizeMessage(currentChatId!, assistantId),

                onError: message => {
                    console.error(message);
                    setIsThinking(false);
                }
            });
        } catch (err) {
            console.error(err);
            setIsThinking(false);
        }
    };

    const appendToken = (chatId: string, messageId: string, token: string) => {
        setChats(prev =>
            prev.map(chat =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: chat.messages.map(m =>
                            m.id === messageId
                                ? {
                                    ...m,
                                    content: m.content + token
                                }
                                : m
                        )
                    }
                    : chat
            )
        );
    };

    const attachCitation = (
        chatId: string,
        messageId: string,
        citation: Citation
    ) => {
        setChats(prev =>
            prev.map(chat =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: chat.messages.map(m =>
                            m.id === messageId
                                ? {
                                    ...m,
                                    citations: [
                                        ...(m.citations ?? []),
                                        citation
                                    ]
                                }
                                : m
                        )
                    }
                    : chat
            )
        );
    };

    const finalizeMessage = (chatId: string, messageId: string) => {
        setIsThinking(false);

        setChats(prev =>
            prev.map(chat =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: chat.messages.map(m =>
                            m.id === messageId
                                ? {
                                    ...m,
                                    isStreaming: false
                                }
                                : m
                        )
                    }
                    : chat
            )
        );
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!newRequest.trim()) return;

        void addMessage(newRequest);

        setNewRequest('');
    };

    return {
        chat,
        chatId,
        chats,
        handleSubmit,
        isThinking,
        newRequest,
        setNewRequest
    };
}