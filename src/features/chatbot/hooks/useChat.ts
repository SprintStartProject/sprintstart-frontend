import { useEffect, useState } from "react";
import {useNavigate, useParams} from "react-router-dom";
import {type Citation, createChat, getChats, getMessages, streamMessage} from "../api/chatService";
import type {Chat, ChatMessage} from "../api/chatService";

export function useChat() {
    const { id: chatId } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [chats, setChats] = useState<Chat[]>([]);
    const [newRequest, setNewRequest] = useState('');
    const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null)

    useEffect(() => {
        const loadChats = async () => {
            const data = await getChats();
            setChats(data.chats);
        };

        void loadChats();
    }, []);

    useEffect(() => {
        if (!chatId) {
            return;
        }

        // Only load from server if we don't already have the messages for this chat in state
        // This prevents overwriting locally streaming messages when the URL changes after chat creation
        const hasMessages = messages.length > 0 && messages.some(m => m.chatId === chatId);
        if (hasMessages) {
            return;
        }

        const loadMessages = async () => {
            const data = await getMessages(chatId);
            setMessages(data.messages)
        }

         void loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]); // messages intentionally omitted to avoid reload loop, checked via local variable logic

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
            chatId: currentChatId,
            content: text
        }

        setMessages(prev => [...prev, userMessage]);

        const assistantId = crypto.randomUUID();

        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: "ASSISTANT",
            chatId: currentChatId,
            content: ""
        }

        setMessages(prev => [...prev, assistantMessage]);

        setIsThinking(true);

        // Send request to backend
        try {
            await streamMessage(currentChatId, text, {
                onToken: token =>
                    appendToken(assistantId, token),

                onCitation: citation =>
                    attachCitation(assistantId, citation),

                onDone: () =>
                    finalizeMessage(assistantId),

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

    const appendToken = (messageId: string, token: string) => {
        setMessages(prev =>
            prev.map(m =>
                m.id === messageId
                    ? { ...m, content: m.content + token }
                    : m
            )
        );
    };

    const attachCitation = (
        messageId: string,
        citation: Citation
    ) => {
        setMessages(prev =>
            prev.map(m =>
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
        );
    };

    const finalizeMessage = (messageId: string) => {
        setIsThinking(false);

        setMessages(prev =>
            prev.map(m =>
                m.id === messageId
                    ? {
                        ...m,
                        isStreaming: false
                    }
                    : m
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
        chatId,
        chats,
        handleSubmit,
        isThinking,
        newRequest,
        setNewRequest,
        messages,
        selectedCitation,
        setSelectedCitation
    };
}