import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import {
    createChat,
    getChats,
    getMessages,
    streamMessage
} from "../services/chatService";
import { useAuth } from "./useAuth";
import { ChatContext } from "./ChatContext";
import type { ChatContextValue, SelectedCitation } from "./ChatContext";
import type { Chat, ChatMessage, SourceSystem } from "../features/chatbot/types";

type MessagesByChat = Record<string, ChatMessage[]>;

/**
 * Global chat state provider. Mounted at the app root so chat state (messages,
 * streaming, filters) survives navigation — the AI stream continues in the
 * background even when the user leaves the chat page and returns later.
 *
 * Has no router dependency; `sendMessage` receives `chatId` and `navigate`
 * from the `useChat` hook which lives inside the router.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth();
    const userId = profile?.id ?? "";

    const [chats, setChats] = useState<Chat[]>([]);
    const [messagesByChat, setMessagesByChat] = useState<MessagesByChat>({});

    const [isThinking, setIsThinking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);

    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [thinkingState, setThinkingState] = useState<string | null>(null);

    const [selectedCitation, setSelectedCitation] = useState<SelectedCitation | null>(null);
    const [newRequest, setNewRequest] = useState("");

    const [showFilters, setShowFilters] = useState(false);

    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const [sourceSystems, setSourceSystems] = useState<SourceSystem[]>([]);

    // AbortController for the in-flight chat stream. Set when a message is
    // sent, cleared on done/error/abort. `stopStreaming` calls `abort()` so
    // the `fetch` reader throws an `AbortError` that `chatService` converts
    // to a clean `onDone` — partial content stays visible.
    const abortControllerRef = useRef<AbortController | null>(null);

    // Guards against redundant per-token state updates (#6). Set to true on
    // the first token, reset on done/error/abort. Without this, every single
    // token re-sets `isStreaming`/`isThinking`/`streamingMessageId` even
    // though they only need to change once at the start of the stream.
    const streamingStartedRef = useRef(false);

    const activeFilterCount = useMemo(() => {
        return sourceSystems.length + (from ? 1 : 0) + (to ? 1 : 0);
    }, [sourceSystems, from, to]);

    const clearFilters = useCallback(() => {
        setFrom("");
        setTo("");
        setSourceSystems([]);
    }, []);

    const toggleSourceSystem = useCallback((source: SourceSystem) => {
        setSourceSystems((current) =>
            current.includes(source)
                ? current.filter((s) => s !== source)
                : [...current, source],
        );
    }, []);

    /**
     * Loads the user's chats once auth is ready (profile.id available).
     * Gated on `userId` so the fetch doesn't fire before Keycloak has
     * initialized — which would 401 and trigger a login redirect loop.
     */
    useEffect(() => {
        if (!userId) return;

        void (async () => {
            const data = await getChats();
            setChats(data.chats.filter(chat => chat.userId === userId));
        })();
    }, [userId]);

    const sortedChats = useMemo(
        () =>
            [...chats].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
        [chats]
    );

    const refreshChats = useCallback(async () => {
        const data = await getChats();
        setChats(data.chats.filter(chat => chat.userId === userId));
    }, [userId]);

    const loadMessages = useCallback(async (chatId: string) => {
        const data = await getMessages(chatId);
        setMessagesByChat(prev => ({
            ...prev,
            [chatId]: data.messages
        }));
    }, []);

    const sendMessage = useCallback(async (
        chatId: string | undefined,
        text: string,
        navigate: NavigateFunction,
    ) => {
        if (!text.trim()) return;

        let currentChatId = chatId;
        let shouldNavigate = false;

        if (!currentChatId) {
            const created = await createChat(userId);

            const newChat = {
                id: created.id,
                title: "",
                userId,
                createdAt: new Date().toISOString(),
            };

            setChats(prev => [newChat, ...prev]);

            currentChatId = newChat.id;
            shouldNavigate = true;
        }

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

        // Add messages to context BEFORE navigating so the new ChatPage
        // sees them immediately on mount — no empty-state flicker.
        setMessagesByChat(prev => ({
            ...prev,
            [currentChatId]: [
                ...(prev[currentChatId] ?? []),
                userMessage,
                assistantMessage
            ]
        }));

        setIsThinking(true);
        streamingStartedRef.current = false;

        // Create a fresh AbortController for this stream so `stopStreaming`
        // can abort it mid-flight.
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Navigate after messages are in state. Don't await — navigate
        // returns void and awaiting would yield to React's state queue,
        // re-rendering ChatPage with chatId=undefined (empty state) before
        // the URL updates.
        if (shouldNavigate) {
            void navigate(`/chat/${currentChatId}`);
        }

        try {
            await streamMessage(currentChatId, text, sourceSystems, from, to, {
                onToolUse: tool => {
                    setThinkingState(tool);
                },

                onReasoning: text => {
                    setIsThinking(false);

                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? { ...m, reasoning: (m.reasoning ?? "") + text }
                                : m
                        )
                    }));
                },

                onToken: token => {
                    // #6: only set streaming flags once, on the first token.
                    if (!streamingStartedRef.current) {
                        streamingStartedRef.current = true;
                        setIsStreaming(true);
                        setIsThinking(false);
                        setStreamingMessageId(assistantId);
                    }

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
                    streamingStartedRef.current = false;
                    abortControllerRef.current = null;
                    setIsStreaming(false);
                    setStreamingMessageId(null);

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
                    streamingStartedRef.current = false;
                    abortControllerRef.current = null;
                    setIsStreaming(false);
                    setIsThinking(false);
                    setStreamingMessageId(null);

                    // #3: surface the error on the assistant message so the
                    // user sees what went wrong, not just a silent stop.
                    setMessagesByChat(prev => ({
                        ...prev,
                        [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                            m.id === assistantId
                                ? { ...m, error: err, isStreaming: false }
                                : m
                        )
                    }));
                }
            }, abortController.signal);
        } catch (e) {
            console.error(e);
            streamingStartedRef.current = false;
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsThinking(false);
            setStreamingMessageId(null);
        }
    }, [chats, refreshChats, userId, sourceSystems, from, to]);

    /**
     * Aborts the in-flight chat stream (if any). The partial content already
     * streamed stays visible — `chatService` converts the `AbortError` into a
     * clean `onDone` call, so state resets exactly as if the stream had ended
     * naturally.
     */
    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const value: ChatContextValue = {
        chats,
        sortedChats,
        messagesByChat,
        isThinking,
        isStreaming,
        streamingMessageId,
        thinkingState,
        selectedCitation,
        setSelectedCitation,
        newRequest,
        setNewRequest,
        showFilters,
        setShowFilters,
        from,
        setFrom,
        to,
        setTo,
        sourceSystems,
        toggleSourceSystem,
        activeFilterCount,
        clearFilters,
        loadMessages,
        sendMessage,
        stopStreaming,
        refreshChats,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
