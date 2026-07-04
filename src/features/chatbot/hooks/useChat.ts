import {useEffect, useMemo, useState, useCallback, useRef} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    createChat,
    getChats,
    getMessages,
    streamMessage
} from "../../../services/chatService";
import { userService } from "../../../services/userService.ts"

import type { Chat, ChatMessage, Citation } from "../types";

type MessagesByChat = Record<string, ChatMessage[]>;

export function useChat() {
    const { id: chatId } = useParams();
    const [userId, setUserId] = useState<string>("");

    const navigate = useNavigate();

    const [chats, setChats] = useState<Chat[]>([]);
    const [messagesByChat, setMessagesByChat] = useState<MessagesByChat>({});

    const [isThinking, setIsThinking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);

    const [thinkingState, setThinkingState] = useState<string | null>(null);

    const [showBrainrot, setShowBrainrot] = useState(false);
    const [timestamp, setTimestamp] = useState(0);

    const [newRequest, setNewRequest] = useState("");

    const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        /**
         * Loads all chats created by the user.
         */
        void (async () => {
            const [data, userData] = await Promise.all([
                getChats(),
                userService.getProfile()
            ]);

            if (!userData?.id) return;

            setUserId(userData.id);

            setChats(data.chats.filter(chat => chat.userId === userData.id));
        })();
    }, []);

    useEffect(() => {
        if (!chatId) return;

        if (messagesByChat[chatId]) return;

        /**
         * Loads all messages from the current chat.
         */
        void (async () => {
            const data = await getMessages(chatId);

            setMessagesByChat(prev => ({
                ...prev,
                [chatId]: data.messages
            }));
        })();
    }, [chatId, messagesByChat]);

    const messages = useMemo(() => {
        if (!chatId) return [];
        return messagesByChat[chatId] ?? [];
    }, [messagesByChat, chatId]);

    useEffect(() => {
        /**
         * Automatically scrolls to the bottom of the current conversation when a new request is sent or when opening an old conversation.
         */
        bottomRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [chatId, messages]);

    const refreshChats = useCallback(async () => {
        const data = await getChats();
        setChats(data.chats.filter(chat => chat.userId === userId));
    }, [userId]);

    useEffect(() => {
        /**
         * Shows Subway Surfers gameplay if the bot needs longer than 4 seconds to reply.
         */
        if (!isThinking) return;

        const timer = setTimeout(() => {
            setTimestamp(Math.floor(Math.random() * 1000));
            setShowBrainrot(true);
        }, 4000);

        return () => {
            clearTimeout(timer);
            setShowBrainrot(false);
        };
    }, [isThinking]);

    useEffect(() => {
        /**
         * Scrolls to the bottom when the gameplay video is shown.
         */
        if (!showBrainrot) return

        bottomRef.current?.scrollIntoView({
            behavior: "smooth"
        });
    }, [showBrainrot]);

    /**
     * Adds a new user message and the corresponding response to the current conversation.
     */
    const addMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        let currentChatId = chatId;

        // create new chat if needed
        if (!currentChatId) {
            const newChat = await createChat(userId);

            setChats(prev => [newChat, ...prev]);

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

                onToolUse: tool => {
                    setThinkingState(tool);
                },

                // if the stream element is a normal text chunk, append it to the response message
                onToken: token => {
                    setIsStreaming(true);
                    setIsThinking(false);

                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? { ...m, content: m.content + token }
                                : m
                        )
                    }));
                },

                // if the stream element is a citations, add it to the citations list of the response message
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

                // if the stream element marks the end of the stream, finalize the message
                onDone: () => {
                    setIsStreaming(false);

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

                // if the stream element is an error, abort
                onError: err => {
                    console.error(err);
                    setIsStreaming(false);
                    setIsThinking(false);
                }
            });
        } catch (e) {
            console.error(e);
            setIsStreaming(false);
            setIsThinking(false);
        }
    }, [chatId, navigate, chats, refreshChats, userId]);

    /**
     * Adds the newly created messages to the chat.
     */
    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!newRequest.trim()) return;

        void addMessage(newRequest);
        setNewRequest("");

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }, [newRequest, addMessage]);

    /**
     * The chat currently used by the user.
     */
    const activeChat = useMemo(() => {
        if (!chatId) return null;
        return chats.find(c => c.id === chatId) ?? null;
    }, [chats, chatId]);

    return {
        chats,
        chatId,
        activeChat,

        messages,

        sidebarOpen,
        setSidebarOpen,

        handleSubmit,
        addMessage,

        newRequest,
        setNewRequest,

        isThinking,
        isStreaming,

        thinkingState,

        selectedCitation,
        setSelectedCitation,

        textareaRef,
        bottomRef,

        showBrainrot,
        timestamp
    };
}