import {useEffect, useMemo, useState, useCallback, useRef} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    createChat,
    getChats,
    getMessages,
    streamMessage
} from "../../../services/chatService";
import { userService } from "../../../services/userService.ts"

import type { Chat, ChatMessage } from "../types";

type MessagesByChat = Record<string, ChatMessage[]>;

/**
 * Manages the state and business logic for the chat interface.
 * Handles fetching chat history, initiating new chats, and streaming responses
 * from the AI assistant via the backend.
 */
export function useChat() {
    const { id: chatId } = useParams();
    const [userId, setUserId] = useState<string>("");

    const navigate = useNavigate();

    const [chats, setChats] = useState<Chat[]>([]);
    const [messagesByChat, setMessagesByChat] = useState<MessagesByChat>({});

    const [isThinking, setIsThinking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);

    const [newRequest, setNewRequest] = useState("");

    const [sidebarOpen, setSidebarOpen] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const prevChatIdRef = useRef<string | undefined>(undefined);
    const prevMessageCountRef = useRef(0);

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

    /**
     * Chats sorted most-recent first, so the newest conversation sits at the top
     * of the sidebar regardless of the order the backend returns them in.
     */
    const sortedChats = useMemo(
        () =>
            [...chats].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
        [chats]
    );

    useEffect(() => {
        /**
         * Scrolls to the bottom when opening a conversation or sending a new message.
         * During token streaming it only follows along if the user is already near
         * the bottom, so scrolling up to read older messages is never hijacked.
         */
        const chatChanged = chatId !== prevChatIdRef.current;
        const messageAdded = messages.length > prevMessageCountRef.current;

        prevChatIdRef.current = chatId;
        prevMessageCountRef.current = messages.length;

        if (chatChanged || messageAdded) {
            bottomRef.current?.scrollIntoView({
                behavior: chatChanged ? "auto" : "smooth"
            });
            return;
        }

        const container = scrollContainerRef.current;
        if (!container) return;

        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;

        if (distanceFromBottom < 120) {
            bottomRef.current?.scrollIntoView();
        }
    }, [chatId, messages]);

    /**
     * Refreshes the list of chats for the current user.
     * Called after a stream finishes to ensure the new chat appears in the sidebar.
     */
    const refreshChats = useCallback(async () => {
        const data = await getChats();
        setChats(data.chats.filter(chat => chat.userId === userId));
    }, [userId]);

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

            // Release focus so keyboard shortcuts (e.g. the easter egg's
            // spacebar trigger) are not swallowed by the textarea.
            textareaRef.current.blur();
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
        chats: sortedChats,
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

        textareaRef,
        bottomRef,
        scrollContainerRef
    };
}