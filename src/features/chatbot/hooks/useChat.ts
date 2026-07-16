import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatContext } from "../../../context/ChatContext";

/**
 * Consumes the global {@link ChatContext} and combines it with router params
 * (`chatId`) and component-local UI state (sidebar toggle, DOM refs, scroll
 * behavior). The heavy lifting — message state, streaming, filters — lives in
 * the provider so it survives navigation away from the chat page.
 */
export function useChat() {
    const ctx = useContext(ChatContext);
    if (ctx === undefined) {
        throw new Error("useChat must be used within a ChatProvider");
    }

    const { id: chatId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const prevChatIdRef = useRef<string | undefined>(undefined);
    const prevMessageCountRef = useRef(0);

    const {
        messagesByChat,
        loadMessages,
        chats,
        sortedChats,
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
        sendMessage,
        stopStreaming,
    } = ctx;

    /**
     * When the user navigates to `/chat` (no chatId) from the main sidebar
     * and they already have conversations, redirect to the most recent one
     * instead of showing the empty state. The "New Chat" button in the chat
     * sidebar passes `state: { newChat: true }` to opt out of this redirect.
     * Also skips if the user has started typing (newRequest is non-empty).
     */
    const isNewChatRequest = (location.state as { newChat?: boolean } | null)?.newChat === true;

    useEffect(() => {
        if (chatId || isNewChatRequest || newRequest) return;
        if (sortedChats.length === 0) return;
        void navigate(`/chat/${sortedChats[0].id}`, { replace: true });
    }, [chatId, isNewChatRequest, newRequest, sortedChats, navigate]);

    const messages = useMemo(() => {
        if (!chatId) return [];
        return messagesByChat[chatId] ?? [];
    }, [messagesByChat, chatId]);

    const activeChat = useMemo(() => {
        if (!chatId) return null;
        return chats.find(c => c.id === chatId) ?? null;
    }, [chats, chatId]);

    /**
     * Loads messages from the backend when a chat is opened for the first time
     * (not yet cached in `messagesByChat`). If the user navigates away and
     * comes back, cached messages are shown immediately — no refetch.
     */
    useEffect(() => {
        if (!chatId) return;
        if (messagesByChat[chatId]) return;
        void loadMessages(chatId);
    }, [chatId, messagesByChat, loadMessages]);

    useEffect(() => {
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

    const addMessage = useCallback((text: string) => {
        return sendMessage(chatId, text, navigate);
    }, [sendMessage, chatId, navigate]);

    const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!newRequest.trim()) return;

        void addMessage(newRequest);
        setNewRequest("");

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.blur();
        }
    }, [newRequest, addMessage, setNewRequest]);

    return {
        chats: sortedChats,
        chatId,
        activeChat,

        messages,

        sidebarOpen,
        setSidebarOpen,

        desktopSidebarOpen,
        setDesktopSidebarOpen,

        handleSubmit,
        addMessage,
        stopStreaming,

        newRequest,
        setNewRequest,

        isThinking,
        isStreaming,

        thinkingState,

        streamingMessageId,

        selectedCitation,
        setSelectedCitation,

        textareaRef,
        bottomRef,
        scrollContainerRef,

        showFilters,
        setShowFilters,

        from,
        setFrom,

        to,
        setTo,

        sourceSystems,

        toggleSourceSystem,

        activeFilterCount,
        clearFilters
    };
}
