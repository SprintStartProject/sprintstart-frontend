import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import {
    createChat,
    getMyChats,
    getMessages,
    streamMessage
} from "../services/chatService";
import { useAuth } from "./useAuth";
import { ChatContext } from "./ChatContext";
import type { ChatContextValue, SelectedCitation } from "./ChatContext";
import type { Chat, ChatMessage, Citation, SourceSystem } from "../features/chatbot/types";

type MessagesByChat = Record<string, ChatMessage[]>;

/**
 * Mutable buffer for the in-flight assistant message. Token/reasoning/citation
 * events append here and are flushed to React state at most once per animation
 * frame via `requestAnimationFrame` — turning O(tokens) state updates into
 * O(frames) (typically a 10–60× reduction for fast streams) while keeping the
 * streaming feel intact.
 */
type StreamingDraft = {
    chatId: string;
    assistantId: string;
    content: string;
    reasoning: string;
    citations: Citation[];
    rafId: number | null;
};

/**
 * Derives a short fallback title from the first user message so the sidebar
 * never shows an empty / "Thinking..." label indefinitely. The backend remains
 * the source of truth; this is only a client-side safety net used until the
 * backend reports a real title (or forever if it never sets one).
 */
function deriveTitle(text: string): string {
    const trimmed = text.trim().replace(/\s+/g, " ");
    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

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

    // Monotonic id per `sendMessage` call. Each handler captures the streamId
    // it was created for and no-ops if it doesn't match the current value —
    // this prevents a stale stream's `onDone`/`onError` from clobbering the
    // flags of a newer stream started after the user switched chats or sent
    // another message while the old one was still in flight.
    const streamIdRef = useRef(0);

    // Always-current snapshot of `chats` so `sendMessage` can read the latest
    // list (including a freshly-created chat) without depending on `chats` in
    // its `useCallback` deps — which would recreate the callback on every send
    // and churn downstream consumers. Synced in an effect because refs must
    // not be mutated during render.
    const chatsRef = useRef<Chat[]>(chats);
    useEffect(() => { chatsRef.current = chats; }, [chats]);

    // Always-current snapshot of filter state for the same reason.
    const filtersRef = useRef({ sourceSystems, from, to });
    useEffect(() => { filtersRef.current = { sourceSystems, from, to }; }, [sourceSystems, from, to]);

    // Tracks the latest chatId a `loadMessages` call was issued for, so a
    // slow response for an older chat can't overwrite the messages of the
    // chat the user has since navigated to.
    const latestLoadRef = useRef<string | null>(null);

    // rAF-batched draft of the in-flight assistant message (see StreamingDraft).
    const draftRef = useRef<StreamingDraft | null>(null);

    // C1: inter-event timeout id for the in-flight stream. Kept at the
    // component level so `stopStreaming` can clear it.
    const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearStreamTimeout = useCallback(() => {
        if (streamTimeoutRef.current !== null) {
            clearTimeout(streamTimeoutRef.current);
            streamTimeoutRef.current = null;
        }
    }, []);

    /**
     * Flushes the buffered streaming draft into React state in one update.
     * Called by `requestAnimationFrame`; also called synchronously on
     * done/error/abort so the final tokens are never lost.
     */
    const flushDraft = useCallback(() => {
        const draft = draftRef.current;
        if (!draft) return;
        draft.rafId = null;
        const { chatId, assistantId, content, reasoning, citations } = draft;
        setMessagesByChat(prev => ({
            ...prev,
            [chatId]: (prev[chatId] ?? []).map(m =>
                m.id === assistantId
                    ? { ...m, content, reasoning, citations }
                    : m
            )
        }));
    }, []);

    const cancelDraft = useCallback(() => {
        const draft = draftRef.current;
        if (draft && draft.rafId !== null) {
            cancelAnimationFrame(draft.rafId);
            draft.rafId = null;
        }
    }, []);

    const scheduleDraftFlush = useCallback(() => {
        const draft = draftRef.current;
        if (!draft || draft.rafId !== null) return;
        draft.rafId = requestAnimationFrame(flushDraft);
    }, [flushDraft]);

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
     * Also resets all chat state when the authenticated user changes so a
     * previous user's messages/chats are never visible to the next one.
     */
    useEffect(() => {
        if (!userId) return;

        // Reset + fetch run inside an async callback so the synchronous resets
        // (before the first await) don't trip the "setState in effect body"
        // lint rule — they execute in the same tick, just outside the effect
        // body's direct call frame.
        void (async () => {
            // Reset stale state from a previous session whenever the user changes.
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
            clearStreamTimeout();
            streamingStartedRef.current = false;
            streamIdRef.current += 1;
            latestLoadRef.current = null;
            if (draftRef.current && draftRef.current.rafId !== null) {
                cancelAnimationFrame(draftRef.current.rafId);
            }
            draftRef.current = null;
            setIsThinking(false);
            setIsStreaming(false);
            setStreamingMessageId(null);
            setThinkingState(null);
            setMessagesByChat({});

            try {
                const data = await getMyChats();
                setChats(data?.chats ?? []);
            } catch (e) {
                console.error("Failed to load chats", e);
                setChats([]);
            }
        })();
    }, [userId, clearStreamTimeout]);

    const sortedChats = useMemo(
        () =>
            [...(chats ?? [])].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
        [chats]
    );

    const refreshChats = useCallback(async () => {
        const data = await getMyChats();
        setChats(data?.chats ?? []);
    }, []);

    const loadMessages = useCallback(async (chatId: string) => {
        // Mark this chat as the latest requested so a slow earlier response
        // can be ignored after the user switches chats.
        latestLoadRef.current = chatId;
        try {
            const data = await getMessages(chatId);

            // Ignore the response if the user has since navigated to a different chat.
            if (latestLoadRef.current !== chatId) return;

            setMessagesByChat(prev => {
                // Don't overwrite if messages were added while we were fetching
                // (e.g., sendMessage added a user+assistant pair). Without this
                // guard, a slow loadMessages response can clobber messages that
                // were optimistically added, causing the streamed content to be
                // lost (the flush maps over an empty array and finds nothing).
                if (prev[chatId] !== undefined && prev[chatId].length > 0) return prev;
                return { ...prev, [chatId]: data.messages };
            });
        } catch (e) {
            console.error("Failed to load messages for chat " + chatId, e);
        }
    }, []);

    const sendMessage = useCallback(async (
        chatId: string | undefined,
        text: string,
        navigate: NavigateFunction,
    ) => {
        if (!text.trim()) return;

        // Invalidate any previous stream so its handlers can't clobber state.
        const thisStreamId = ++streamIdRef.current;

        let currentChatId = chatId;
        let shouldNavigate = false;
        let chatForMessages: Chat | undefined;

        if (!currentChatId) {
            const created = await createChat(userId);

            const newChat: Chat = {
                id: created.id,
                // Client-side fallback title so the sidebar shows something
                // meaningful immediately; the backend may overwrite it later.
                title: deriveTitle(text),
                userId,
                createdAt: new Date().toISOString(),
            };

            setChats(prev => [newChat, ...prev]);

            currentChatId = newChat.id;
            chatForMessages = newChat;
            shouldNavigate = true;
        } else {
            // B1: read from the always-current ref snapshot so we find the
            // chat even if `chats` state hasn't flushed yet.
            chatForMessages = chatsRef.current.find(chat => chat.id === currentChatId);
        }

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "USER",
            chat: chatForMessages,
            content: text
        };

        const assistantId = crypto.randomUUID();

        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: "ASSISTANT",
            chat: chatForMessages,
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

        // Initialize the rAF-batched draft so token/reasoning/citation events
        // append to a mutable buffer instead of triggering a state update each.
        draftRef.current = {
            chatId: currentChatId,
            assistantId,
            content: "",
            reasoning: "",
            citations: [],
            rafId: null,
        };

        // Create a fresh AbortController for this stream so `stopStreaming`
        // can abort it mid-flight.
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // C1: inter-event timeout. Reset on every SSE event (token, reasoning,
        // citation, tool_use) so a slow "reasoning" phase doesn't get cut off.
        // Only fires when the connection goes completely silent for the whole
        // window — surfacing a visible error instead of an infinite spinner.
        const STREAM_TIMEOUT_MS = 300_000;
        const armStreamTimeout = () => {
            clearStreamTimeout();
            streamTimeoutRef.current = setTimeout(() => {
                if (!isCurrentStream()) return;
                console.error("Chat stream timed out (no events for " + STREAM_TIMEOUT_MS + "ms)");
                // Abort so chatService's reader throws → onDone path runs.
                abortController.abort();
                // Surface a visible error on the assistant message.
                resetStreamingState();
                setMessagesByChat(prev => ({
                    ...prev,
                    [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                        m.id === assistantId
                            ? { ...m, error: "The response timed out. Please try again.", isStreaming: false }
                            : m
                    )
                }));
            }, STREAM_TIMEOUT_MS);
        };
        armStreamTimeout();

        // Navigate after messages are in state. Don't await — navigate
        // returns void and awaiting would yield to React's state queue,
        // re-rendering ChatPage with chatId=undefined (empty state) before
        // the URL updates.
        if (shouldNavigate) {
            void navigate(`/chat/${currentChatId}`);
        }

        // Helper: only apply state changes if this stream is still the
        // active one. Prevents a stale stream from resetting flags that
        // belong to a newer stream.
        const isCurrentStream = () => streamIdRef.current === thisStreamId;

        const resetStreamingState = () => {
            if (!isCurrentStream()) return;
            streamingStartedRef.current = false;
            abortControllerRef.current = null;
            setIsStreaming(false);
            setIsThinking(false);
            setStreamingMessageId(null);
        };

        try {
            const { sourceSystems: ss, from: f, to: t } = filtersRef.current;
            await streamMessage(currentChatId, text, ss, f, t, {
                onToolUse: tool => {
                    if (!isCurrentStream()) return;
                    armStreamTimeout();
                    setThinkingState(tool);
                },

                onReasoning: reasoningText => {
                    if (!isCurrentStream()) return;
                    armStreamTimeout();
                    setIsThinking(false);

                    const draft = draftRef.current;
                    if (draft) {
                        draft.reasoning += reasoningText;
                        scheduleDraftFlush();
                    }
                },

                onToken: token => {
                    if (!isCurrentStream()) return;
                    armStreamTimeout();
                    // #6: only set streaming flags once, on the first token.
                    if (!streamingStartedRef.current) {
                        streamingStartedRef.current = true;
                        setIsStreaming(true);
                        setIsThinking(false);
                        setStreamingMessageId(assistantId);
                    }

                    const draft = draftRef.current;
                    if (draft) {
                        draft.content += token;
                        scheduleDraftFlush();
                    }
                },

                onCitation: citation => {
                    if (!isCurrentStream()) return;
                    armStreamTimeout();
                    const draft = draftRef.current;
                    if (draft) {
                        draft.citations = [...draft.citations, citation];
                        scheduleDraftFlush();
                    }
                },

                onDone: () => {
                    clearStreamTimeout();
                    // Flush any buffered tokens synchronously so the final
                    // content is committed before we clear the streaming flag.
                    cancelDraft();
                    flushDraft();
                    draftRef.current = null;

                    resetStreamingState();

                    if (!isCurrentStream()) return;
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
                    clearStreamTimeout();
                    console.error(err);
                    cancelDraft();
                    flushDraft();
                    draftRef.current = null;

                    resetStreamingState();

                    if (!isCurrentStream()) return;
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
            // Safety net: chatService should never throw (all errors go to
            // onError), but if something truly unexpected slips through we
            // still route it to the visible error banner instead of leaving
            // a stuck empty bubble.
            clearStreamTimeout();
            console.error(e);
            cancelDraft();
            flushDraft();
            draftRef.current = null;
            resetStreamingState();

            if (!isCurrentStream()) return;
            setMessagesByChat(prev => ({
                ...prev,
                [currentChatId]: (prev[currentChatId] ?? []).map(m =>
                    m.id === assistantId
                        ? { ...m, error: "Unexpected error during streaming.", isStreaming: false }
                        : m
                )
            }));
        }
    }, [refreshChats, userId, cancelDraft, flushDraft, scheduleDraftFlush, clearStreamTimeout]);

    /**
     * Aborts the in-flight chat stream (if any). The partial content already
     * streamed stays visible — `chatService` converts the `AbortError` into a
     * clean `onDone` call, so state resets exactly as if the stream had ended
     * naturally. Also clears `isThinking` in case the user stops before the
     * first token/reasoning event arrives.
     */
    const stopStreaming = useCallback(() => {
        // Invalidate the current stream so its onDone (triggered by the abort)
        // can't re-set flags after we clear them here.
        streamIdRef.current += 1;
        clearStreamTimeout();
        cancelDraft();
        flushDraft();
        draftRef.current = null;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        streamingStartedRef.current = false;
        setIsStreaming(false);
        setIsThinking(false);
        setStreamingMessageId(null);
    }, [cancelDraft, flushDraft, clearStreamTimeout]);

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
