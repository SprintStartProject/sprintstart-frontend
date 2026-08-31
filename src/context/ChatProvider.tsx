import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import type { NavigateFunction } from "react-router-dom";
import {
  createChat,
  deleteChat as apiDeleteChat,
  getMyChats,
  getMessages,
  streamMessage,
} from "../services/chatService";
import { useAuth } from "./useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
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

  // Chats live inside a project: the list is scoped to it and a new chat is created
  // in it. Switching projects therefore has to reset chat state the same way a user
  // change does — otherwise the previous project's chats and cached messages stay on
  // screen while the sidebar has already moved on.
  const { selectedProjectId } = useProjectContext();

  const [chats, setChats] = useState<Chat[]>([]);
  // The project `chats` was last loaded for. Consumers need it to tell "this project has no
  // such chat" apart from "the list has not arrived yet" — the difference between redirecting
  // away from a foreign chat and flickering away from a legitimate one.
  const [chatsProjectId, setChatsProjectId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<MessagesByChat>({});

  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [thinkingState, setThinkingState] = useState<string | null>(null);

  // The chat the in-flight stream belongs to. The flags above are global
  // (one stream at a time), so without this the thinking indicator, the
  // composer's busy state and the stop button follow the user into whatever
  // chat they switch to. Consumers gate on this in `useChat`.
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);

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
  // Set when a `tool_use` event lands mid-stream. Answer tokens that arrive
  // after tool activity need a paragraph break before them, otherwise the
  // first token of the post-tool answer glues onto pre-tool preamble text
  // ("Let me search…Searching knowledge base…") inside the same bubble.
  const sawToolUseRef = useRef(false);

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
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Always-current snapshot of the (user, project) scope for the same reason:
  // the chat-list fetch below reads these through the ref so a slow response
  // can tell whether the user or the selected project changed while it was in
  // flight — and drop itself instead of overwriting the newer scope's list.
  const scopeRef = useRef({ userId, selectedProjectId });
  useEffect(() => {
    scopeRef.current = { userId, selectedProjectId };
  }, [userId, selectedProjectId]);

  // Always-current snapshot of filter state for the same reason.
  const filtersRef = useRef({ sourceSystems, from, to });
  useEffect(() => {
    filtersRef.current = { sourceSystems, from, to };
  }, [sourceSystems, from, to]);

  // Tracks the latest chatId a `loadMessages` call was issued for, so a
  // slow response for an older chat can't overwrite the messages of the
  // chat the user has since navigated to.
  const latestLoadRef = useRef<string | null>(null);

  // Set of deleted chat IDs to prevent any in-flight or subsequent message loading.
  const deletedChatIdsRef = useRef<Set<string>>(new Set());

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
    setMessagesByChat((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] ?? []).map((m) =>
        m.id === assistantId ? { ...m, content, reasoning, citations } : m,
      ),
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
      current.includes(source) ? current.filter((s) => s !== source) : [...current, source],
    );
  }, []);

  /**
   * Loads the user's chats for the selected project once auth is ready.
   * Gated on `userId` so the fetch doesn't fire before Keycloak has
   * initialized — which would 401 and trigger a login redirect loop — and on
   * `selectedProjectId` because the listing is project-scoped.
   * Resets all chat state when either changes, so neither a previous user's nor
   * a previous project's messages are ever visible afterwards.
   */
  useEffect(() => {
    if (!userId || !selectedProjectId) return;

    // Reset + fetch run inside an async callback so the synchronous resets
    // (before the first await) don't trip the "setState in effect body"
    // lint rule — they execute in the same tick, just outside the effect
    // body's direct call frame.
    void (async () => {
      // Reset stale state whenever the user or the selected project changes.
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      clearStreamTimeout();
      streamingStartedRef.current = false;
      sawToolUseRef.current = false;
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
      setStreamingChatId(null);
      setMessagesByChat({});
      setChatsProjectId(null);

      try {
        const data = await getMyChats(selectedProjectId);
        // Drop the response if the user or the selected project changed while
        // the fetch was in flight — otherwise a slow reply for the previous
        // project can land after the new scope's list and overwrite it.
        const { userId: currentUserId, selectedProjectId: currentProjectId } = scopeRef.current;
        if (currentUserId !== userId || currentProjectId !== selectedProjectId) return;
        const filtered = (data?.chats ?? []).filter((c) => !deletedChatIdsRef.current.has(c.id));
        setChats(filtered);
        setChatsProjectId(selectedProjectId);
      } catch (e) {
        if (
          scopeRef.current.userId !== userId ||
          scopeRef.current.selectedProjectId !== selectedProjectId
        ) {
          return;
        }
        console.error("Failed to load chats", e);
        setChats([]);
        setChatsProjectId(selectedProjectId);
      }
    })();
  }, [userId, selectedProjectId, clearStreamTimeout]);

  const sortedChats = useMemo(
    () =>
      [...(chats ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [chats],
  );

  const refreshChats = useCallback(async () => {
    if (!selectedProjectId) return;
    const data = await getMyChats(selectedProjectId);
    const filtered = (data?.chats ?? []).filter((c) => !deletedChatIdsRef.current.has(c.id));
    setChats(filtered);
    setChatsProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const loadMessages = useCallback(async (chatId: string) => {
    if (deletedChatIdsRef.current.has(chatId)) return;

    // Mark this chat as the latest requested so a slow earlier response
    // can be ignored after the user switches chats.
    latestLoadRef.current = chatId;
    try {
      const data = await getMessages(chatId);

      // Ignore the response if the user has since navigated to a different chat or deleted it.
      if (latestLoadRef.current !== chatId || deletedChatIdsRef.current.has(chatId)) return;

      setMessagesByChat((prev) => {
        // Don't overwrite if messages were added while we were fetching
        // (e.g., sendMessage added a user+assistant pair). Without this
        // guard, a slow loadMessages response can clobber messages that
        // were optimistically added, causing the streamed content to be
        // lost (the flush maps over an empty array and finds nothing).
        if (prev[chatId] !== undefined && prev[chatId].length > 0) return prev;
        return { ...prev, [chatId]: data.messages };
      });
    } catch (e) {
      if (latestLoadRef.current !== chatId || deletedChatIdsRef.current.has(chatId)) return;
      console.error("Failed to load messages for chat " + chatId, e);
    }
  }, []);

  const sendMessage = useCallback(
    async (chatId: string | undefined, text: string, navigate: NavigateFunction) => {
      if (!text.trim()) return;

      // Invalidate any previous stream so its handlers can't clobber state.
      const thisStreamId = ++streamIdRef.current;

      // Settle a stream that is still in flight before starting a new one.
      // The id bump above already silenced its handlers, so without this the
      // request would keep streaming in the background while its chat kept an
      // empty assistant bubble forever — no content, no error, and no refetch
      // (`loadMessages` skips chats that are already cached).
      const orphan = draftRef.current;
      clearStreamTimeout();
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (orphan) {
        cancelDraft();
        flushDraft();
        draftRef.current = null;
        // Partial content stays visible, exactly like a manual stop. Only a
        // bubble that never received a content token needs an explanation.
        if (!orphan.content) {
          setMessagesByChat((prev) => ({
            ...prev,
            [orphan.chatId]: (prev[orphan.chatId] ?? []).map((m) =>
              m.id === orphan.assistantId
                ? { ...m, error: "Interrupted by a new message.", isStreaming: false }
                : m,
            ),
          }));
        }
      }

      let currentChatId = chatId;
      let shouldNavigate = false;
      let chatForMessages: Chat | undefined;

      if (!currentChatId) {
        // A chat is always created inside a project. Without one there is nothing
        // to scope retrieval to, so the backend would reject the request anyway.
        if (!selectedProjectId) {
          console.error("Cannot create a chat without a selected project");
          return;
        }
        const created = await createChat(selectedProjectId);

        const newChat: Chat = {
          id: created.id,
          // Client-side fallback title so the sidebar shows something
          // meaningful immediately; the backend may overwrite it later.
          title: deriveTitle(text),
          userId,
          projectId: selectedProjectId,
          createdAt: new Date().toISOString(),
        };

        setChats((prev) => [newChat, ...prev]);

        currentChatId = newChat.id;
        chatForMessages = newChat;
        shouldNavigate = true;
      } else {
        // B1: read from the always-current ref snapshot so we find the
        // chat even if `chats` state hasn't flushed yet.
        chatForMessages = chatsRef.current.find((chat) => chat.id === currentChatId);
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "USER",
        chat: chatForMessages,
        content: text,
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
      setMessagesByChat((prev) => ({
        ...prev,
        [currentChatId]: [...(prev[currentChatId] ?? []), userMessage, assistantMessage],
      }));

      setIsThinking(true);
      // A follow-up sent mid-stream would otherwise inherit the previous
      // stream's flags — a caret on a message that no longer receives tokens
      // and the previous turn's tool label under the dots.
      setIsStreaming(false);
      setStreamingMessageId(null);
      setThinkingState(null);
      setStreamingChatId(currentChatId);
      streamingStartedRef.current = false;
      sawToolUseRef.current = false;

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
          setMessagesByChat((prev) => ({
            ...prev,
            [currentChatId]: (prev[currentChatId] ?? []).map((m) =>
              m.id === assistantId
                ? { ...m, error: "The response timed out. Please try again.", isStreaming: false }
                : m,
            ),
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
        sawToolUseRef.current = false;
        abortControllerRef.current = null;
        setIsStreaming(false);
        setIsThinking(false);
        setStreamingMessageId(null);
        // Without this the last tool label survives the turn and is shown
        // again at the start of the next one, before the first real
        // `tool_use` event arrives.
        setThinkingState(null);
        setStreamingChatId(null);
      };

      try {
        const { sourceSystems: ss, from: f, to: t } = filtersRef.current;
        await streamMessage(
          currentChatId,
          text,
          ss,
          f,
          t,
          {
            onToolUse: (tool) => {
              if (!isCurrentStream()) return;
              armStreamTimeout();
              sawToolUseRef.current = true;
              setThinkingState(tool);
            },

            onReasoning: (reasoningText) => {
              if (!isCurrentStream()) return;
              armStreamTimeout();
              if (!streamingStartedRef.current) {
                streamingStartedRef.current = true;
                setIsStreaming(true);
                setIsThinking(false);
                setStreamingMessageId(assistantId);
              }

              const draft = draftRef.current;
              if (draft) {
                draft.reasoning += reasoningText;
                scheduleDraftFlush();
              }
            },

            onToken: (token) => {
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
                // Paragraph break between any pre-tool preamble and the
                // post-tool answer — once, at the first token after tool
                // activity, and only when there is preamble to separate.
                if (sawToolUseRef.current && draft.content.trim() !== "") {
                  draft.content += "\n\n";
                  sawToolUseRef.current = false;
                }
                draft.content += token;
                scheduleDraftFlush();
              }
            },

            onCitation: (citation) => {
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
              setMessagesByChat((prev) => ({
                ...prev,
                [currentChatId]: (prev[currentChatId] ?? []).map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m,
                ),
              }));

              void refreshChats();
            },

            onError: (err) => {
              clearStreamTimeout();
              console.error(err);
              cancelDraft();
              flushDraft();
              draftRef.current = null;

              resetStreamingState();

              if (!isCurrentStream()) return;
              // #3: surface the error on the assistant message so the
              // user sees what went wrong, not just a silent stop.
              setMessagesByChat((prev) => ({
                ...prev,
                [currentChatId]: (prev[currentChatId] ?? []).map((m) =>
                  m.id === assistantId ? { ...m, error: err, isStreaming: false } : m,
                ),
              }));
            },
          },
          abortController.signal,
        );
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
        setMessagesByChat((prev) => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] ?? []).map((m) =>
            m.id === assistantId
              ? { ...m, error: "Unexpected error during streaming.", isStreaming: false }
              : m,
          ),
        }));
      }
    },
    [
      refreshChats,
      userId,
      selectedProjectId,
      cancelDraft,
      flushDraft,
      scheduleDraftFlush,
      clearStreamTimeout,
    ],
  );

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
    const stopped = draftRef.current;
    draftRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamingStartedRef.current = false;
    sawToolUseRef.current = false;
    setIsStreaming(false);
    setIsThinking(false);
    setStreamingMessageId(null);
    setThinkingState(null);
    setStreamingChatId(null);

    // Stopping before the first token would otherwise leave a bare empty
    // bubble (or reasoning without an answer/explanation) — the placeholder
    // is only hidden while `isThinking` is true.
    if (stopped && !stopped.content) {
      setMessagesByChat((prev) => ({
        ...prev,
        [stopped.chatId]: (prev[stopped.chatId] ?? []).map((m) =>
          m.id === stopped.assistantId
            ? { ...m, error: "Stopped before the assistant replied.", isStreaming: false }
            : m,
        ),
      }));
    }

    // The abort reaches `onDone` with an already-invalidated stream id, so
    // its `refreshChats` is skipped — a chat stopped right after creation
    // would keep the client-side fallback title forever.
    void refreshChats().catch((e) => console.error("Failed to refresh chats", e));
  }, [cancelDraft, flushDraft, clearStreamTimeout, refreshChats]);

  /**
   * Deletes a chat conversation and all of its messages for the authenticated user,
   * cleaning up associated state and drafts.
   */
  const deleteChat = useCallback(
    async (chatId: string) => {
      deletedChatIdsRef.current.add(chatId);

      try {
        // If the deleted chat is actively streaming, abort it cleanly first
        if (streamingChatId === chatId) {
          stopStreaming();
        }

        if (latestLoadRef.current === chatId) {
          latestLoadRef.current = null;
        }

        await apiDeleteChat(chatId);

        // Remove from chats list
        setChats((prev) => prev.filter((c) => c.id !== chatId));

        // Evict cached messages
        setMessagesByChat((prev) => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });

        // Evict persisted draft from localStorage
        localStorage.removeItem(`chatDraft.${chatId}`);
      } catch (err) {
        deletedChatIdsRef.current.delete(chatId);
        void refreshChats().catch((e) =>
          console.error("Failed to refresh chats after delete rollback", e),
        );
        throw err;
      }
    },
    [streamingChatId, stopStreaming, refreshChats],
  );

  const value: ChatContextValue = {
    chats,
    sortedChats,
    chatsProjectId,
    selectedProjectId,
    messagesByChat,
    isThinking,
    isStreaming,
    streamingMessageId,
    thinkingState,
    streamingChatId,
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
    deleteChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
