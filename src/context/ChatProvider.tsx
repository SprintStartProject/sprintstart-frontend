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
import { useToastApi } from "./useToast";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ChatContext } from "./ChatContext";
import type { ChatContextValue, SelectedCitation } from "./ChatContext";
import type {
  Chat,
  ChatMessage,
  ChatQueueItem,
  Citation,
  SourceSystem,
} from "../features/chatbot/types";
import { insertQuoteIntoDraft } from "../features/chatbot/utils/quoteFormat";

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
  // The API-only half of the toast context: raising a chat error must not
  // re-render the whole chat tree every time some other toast appears or
  // auto-dismisses. See `useToastApi`.
  const toast = useToastApi();

  // Chats live inside a project: the list is scoped to it and a new chat is created
  // in it. Switching projects therefore has to reset chat state the same way a user
  // change does — otherwise the previous project's chats and cached messages stay on
  // screen while the sidebar has already moved on.
  const { hasSelectedProject, selectedProjectId } = useProjectContext();

  // Chats are asked for only once a project is confirmed. The provider never publishes an
  // unconfirmed ID (a stored one or a `?projectId=` deep link is held back until the loaded
  // list vouches for it), so this gate is false exactly while the list is still loading —
  // which is when asking about a selection would be premature.

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

  // Synchronous mirror of `streamingChatId`, written through `commitStreamingChat`
  // rather than by an effect: the queue's submit path has to see it in the same
  // tick a turn starts, or a second message typed before React flushes would
  // read `null` and interrupt the turn it should have queued behind.
  const streamingChatIdRef = useRef<string | null>(null);
  const commitStreamingChat = useCallback((chatId: string | null) => {
    streamingChatIdRef.current = chatId;
    setStreamingChatId(chatId);
  }, []);

  /**
   * Messages waiting behind a running answer, oldest first.
   *
   * Held in a ref as well as in state, both written through `commitQueue`: the
   * drain runs from a stream's terminal paths (a callback, not a render) and
   * has to read the queue as it is *now*, while the state half is what the
   * queue strip renders.
   */
  const [queue, setQueue] = useState<ChatQueueItem[]>([]);
  const queueRef = useRef<ChatQueueItem[]>([]);
  const commitQueue = useCallback((next: ChatQueueItem[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  // Same split for the paused flag — `stopStreaming` sets it and the drain
  // reads it, neither inside a render.
  const [queuePaused, setQueuePaused] = useState(false);
  const queuePausedRef = useRef(false);
  const setPaused = useCallback((paused: boolean) => {
    queuePausedRef.current = paused;
    setQueuePaused(paused);
  }, []);

  const [selectedCitation, setSelectedCitation] = useState<SelectedCitation | null>(null);
  const [newRequest, setNewRequest] = useState("");
  const focusComposerFnRef = useRef<(() => void) | null>(null);

  const registerFocusComposer = useCallback((fn: () => void) => {
    focusComposerFnRef.current = fn;
    return () => {
      if (focusComposerFnRef.current === fn) {
        focusComposerFnRef.current = null;
      }
    };
  }, []);

  const quoteSelection = useCallback((text: string) => {
    setNewRequest((prev) => insertQuoteIntoDraft(prev, text));
    requestAnimationFrame(() => {
      focusComposerFnRef.current?.();
    });
  }, []);

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

  // The router's `navigate`, captured at the last submit: a queued message is
  // sent from a callback (a stream's terminal path) that has no router access
  // of its own.
  const lastNavigateRef = useRef<NavigateFunction | null>(null);

  // The queue's two exits, held in refs because the callbacks they point at are
  // defined *after* `sendMessage` while `sendMessage`'s terminal paths need to
  // call them — depending on each other directly would be a dependency cycle
  // between two `useCallback`s.
  //
  //   drainRef  — start the next queued turn for the chat that just finished.
  //   submitRef — what the error toast's "Retry" runs, so a retry queues like
  //               any other send instead of cutting off a newer answer.
  const drainRef = useRef<(chatId: string) => void>(() => {});
  const submitRef = useRef<
    ((chatId: string | undefined, text: string, navigate: NavigateFunction) => void) | null
  >(null);

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
    return sourceSystems.length + (from || to ? 1 : 0);
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
   * `hasSelectedProject`, because the listing is project-scoped and only a
   * project the loaded list contains is known to be one this user reaches.
   * Resets all chat state when either changes, so neither a previous user's nor
   * a previous project's messages are ever visible afterwards.
   */
  useEffect(() => {
    if (!userId || !hasSelectedProject) return;

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
      commitStreamingChat(null);
      // Queued messages belong to the chats of the scope being left — a message
      // queued in another project's chat has no chat to be sent to any more.
      commitQueue([]);
      setPaused(false);
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
  }, [
    userId,
    hasSelectedProject,
    selectedProjectId,
    clearStreamTimeout,
    commitStreamingChat,
    commitQueue,
    setPaused,
  ]);

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

  /**
   * Ends a turn that is still in flight without the user asking for it: the
   * request is aborted, its handlers are silenced, and a bubble that never
   * received a token is marked as interrupted.
   *
   * Reached only when a message is submitted into a *different* chat than the
   * one streaming — a follow-up in the same chat is queued instead, which is
   * the whole point of the queue. A second stream can never be started without
   * settling the first: the abandoned request would keep streaming in the
   * background while its chat kept an empty assistant bubble forever (no
   * content, no notice, and no refetch — `loadMessages` skips cached chats).
   *
   * Deliberately leaves the thinking/streaming flags alone: the caller sets
   * them for the turn it is starting, and clearing them here would flash an
   * empty bubble while a new chat is being created.
   */
  const settleCurrentStream = useCallback(() => {
    // Silence the handlers of the stream being abandoned before touching the
    // state it is still writing to.
    streamIdRef.current += 1;
    clearStreamTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const orphan = draftRef.current;
    if (!orphan) return;

    cancelDraft();
    flushDraft();
    draftRef.current = null;
    // Partial content stays visible, exactly like a manual stop. Only a bubble
    // that never received a content token needs an explanation — and it says
    // the user's own message did this, not a failure.
    if (!orphan.content) {
      setMessagesByChat((prev) => ({
        ...prev,
        [orphan.chatId]: (prev[orphan.chatId] ?? []).map((m) =>
          m.id === orphan.assistantId ? { ...m, notice: "interrupted", isStreaming: false } : m,
        ),
      }));
    }
  }, [cancelDraft, clearStreamTimeout, flushDraft]);

  const sendMessage = useCallback(
    async (chatId: string | undefined, text: string, navigate: NavigateFunction) => {
      if (!text.trim()) return;

      // Settle a stream that is still in flight before starting a new one: this
      // bumps the id, silencing the handlers of the turn it abandons.
      settleCurrentStream();

      // Take this stream's id *after* settling. Taking it first made it stale
      // the moment `settleCurrentStream` bumped again, and every handler of the
      // turn being started was dropped as "not current".
      const thisStreamId = ++streamIdRef.current;

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
      commitStreamingChat(currentChatId);
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
          // Surface the failure as a toast; the abort above makes
          // `chatService` finish the turn through its `onDone` path, which is
          // where the queue is released.
          resetStreamingState();
          reportFailure(
            "The answer timed out",
            "The assistant stopped responding for five minutes.",
          );
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
        commitStreamingChat(null);
      };

      /**
       * Reports a failed turn: a toast, not a banner under the bubble.
       *
       * A failure at the bottom of a long thread is exactly what the user does
       * not see — the answer they were reading has pushed it below the fold, and
       * the thread gives no sign anything went wrong. The toast carries the
       * reason and a Retry, and the partial answer (if any) stays in the thread
       * untouched.
       *
       * Retry goes through `submitRef`, i.e. the same path the composer uses: if
       * the user has since asked something else, it queues behind that answer
       * instead of cutting it off.
       */
      const reportFailure = (message: string, description: string) => {
        toast.error(message, {
          description,
          action: {
            label: "Retry",
            onClick: () => submitRef.current?.(currentChatId, text, navigate),
          },
        });
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
                // post-tool answer — at the first token after tool activity,
                // and only when there is preamble to separate. Re-arms on
                // every `tool_use`, so a multi-tool turn separates each round.
                // trimEnd first: a preamble that already ends in a space or a
                // newline would otherwise leave a trailing space before the
                // break, or stack three-plus newlines, purely depending on how
                // the model happened to chunk it.
                //
                // Except when the break would land mid-word (#231): a tool
                // round whose preamble was cut off upstream (provider token
                // cap, dropped stream) leaves text like "…Bas" right before
                // the `tool_use` event, and the post-tool answer then
                // continues that word with "ierend…". Rendering the break
                // there shows "Bas" and "ierend" as separate paragraphs. A
                // paragraph never starts lowercase, so a letter followed by
                // a lowercase letter is a continuation, not a boundary —
                // append it to the word instead. Uppercase, digits and
                // punctuation keep the break, so real preamble/answer
                // boundaries are unaffected.
                if (sawToolUseRef.current && draft.content.trim() !== "") {
                  const trimmed = draft.content.trimEnd();
                  const continuesWord = /\p{L}$/u.test(trimmed) && /^\p{Ll}/u.test(token);
                  draft.content = continuesWord ? trimmed : `${trimmed}\n\n`;
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

              // The answer is complete, so the next queued message may go.
              drainRef.current(currentChatId);
            },

            onError: (err) => {
              clearStreamTimeout();
              console.error(err);
              cancelDraft();
              flushDraft();
              draftRef.current = null;

              resetStreamingState();

              if (!isCurrentStream()) return;
              reportFailure("The answer failed", err);
              // A failed turn still frees the queue: the next message may well
              // be the retry, and holding it hostage to a failure the user has
              // already been told about helps nobody.
              drainRef.current(currentChatId);
            },
          },
          abortController.signal,
        );
      } catch (e) {
        // Safety net: chatService should never throw (all errors go to
        // onError), but if something truly unexpected slips through the user
        // still has to be told — and the queue still has to move on.
        clearStreamTimeout();
        console.error(e);
        cancelDraft();
        flushDraft();
        draftRef.current = null;
        resetStreamingState();

        if (!isCurrentStream()) return;
        reportFailure("The answer failed", "Unexpected error during streaming.");
        drainRef.current(currentChatId);
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
      commitStreamingChat,
      settleCurrentStream,
      toast,
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
    commitStreamingChat(null);
    // Stop means "stop doing things", so it holds the queue too. The messages
    // stay visible in the strip with a "Send queued" button — silently dropping
    // them would throw away text the user deliberately wrote, and letting them
    // keep firing would make Stop a lie.
    setPaused(true);

    // Stopping before the first token would otherwise leave a bare empty
    // bubble (or reasoning without an answer/explanation) — the placeholder
    // is only hidden while `isThinking` is true.
    if (stopped && !stopped.content) {
      setMessagesByChat((prev) => ({
        ...prev,
        [stopped.chatId]: (prev[stopped.chatId] ?? []).map((m) =>
          m.id === stopped.assistantId ? { ...m, notice: "stopped", isStreaming: false } : m,
        ),
      }));
    }

    // The abort reaches `onDone` with an already-invalidated stream id, so
    // its `refreshChats` is skipped — a chat stopped right after creation
    // would keep the client-side fallback title forever.
    void refreshChats().catch((e) => console.error("Failed to refresh chats", e));
  }, [cancelDraft, flushDraft, clearStreamTimeout, refreshChats, commitStreamingChat, setPaused]);

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
        // …and anything queued for it: the chat it was waiting for no longer
        // exists, so the message has nowhere to go.
        commitQueue(queueRef.current.filter((item) => item.chatId !== chatId));
      } catch (err) {
        deletedChatIdsRef.current.delete(chatId);
        void refreshChats().catch((e) =>
          console.error("Failed to refresh chats after delete rollback", e),
        );
        throw err;
      }
    },
    [streamingChatId, stopStreaming, refreshChats, commitQueue],
  );

  /**
   * Removes one queued message and starts its turn.
   *
   * The single exit from the queue: it takes the item out first, so a send that
   * throws cannot leave the same message to be sent twice, and then goes through
   * `sendMessage` — never `submitMessage` — because the caller has already
   * decided this message's turn is due.
   */
  const startQueuedTurn = useCallback(
    (item: ChatQueueItem) => {
      const navigate = lastNavigateRef.current;
      if (!navigate) return;
      commitQueue(queueRef.current.filter((queued) => queued.id !== item.id));
      void sendMessage(item.chatId, item.text, navigate);
    },
    [commitQueue, sendMessage],
  );

  /**
   * Sends the oldest message queued for `chatId`, if there is one and the queue
   * is not paused.
   *
   * Called from a turn's terminal paths, i.e. only ever when nothing is
   * streaming, so it cannot race the answer it follows. Filtered by chat on
   * purpose: a message queued in a chat the user has since left waits for that
   * chat's next turn rather than being fired into a conversation nobody is
   * looking at.
   */
  const drainNextQueued = useCallback(
    (chatId: string) => {
      if (queuePausedRef.current) return;
      const next = queueRef.current.find((item) => item.chatId === chatId);
      if (next) startQueuedTurn(next);
    },
    [startQueuedTurn],
  );

  /**
   * The composer's entry point — and the only path the chat UI uses to send.
   *
   * Same chat, still answering → queue it. That is the whole point of the
   * change: a follow-up typed while the assistant is mid-sentence used to abort
   * the answer being read, which lost the very thing the user was looking at.
   *
   * Different chat → the running turn is settled instead, because the queue
   * drains per chat and a message for another conversation would otherwise wait
   * forever. A toast says so; silently dropping the answer would be worse.
   */
  const submitMessage = useCallback(
    (chatId: string | undefined, text: string, navigate: NavigateFunction) => {
      if (!text.trim()) return;

      // Queued messages are sent later, from a callback with no router of its
      // own — the navigate has to be remembered here or the queue can only ever
      // be drained while this exact page is mounted.
      lastNavigateRef.current = navigate;

      const runningChatId = streamingChatIdRef.current;

      if (runningChatId !== null && runningChatId === chatId && chatId !== undefined) {
        commitQueue([...queueRef.current, { id: crypto.randomUUID(), chatId, text }]);
        // Sending something new is the user taking over again, so a queue held
        // back by Stop starts moving without them having to press anything else.
        setPaused(false);
        return;
      }

      if (runningChatId !== null && runningChatId !== chatId) {
        settleCurrentStream();
        toast.info("Stopped the answer in the other chat", {
          description: "Your message was sent here instead of queued behind it.",
        });
      }

      void sendMessage(chatId, text, navigate);
    },
    [commitQueue, setPaused, settleCurrentStream, sendMessage, toast],
  );

  const removeQueuedMessage = useCallback(
    (id: string) => {
      commitQueue(queueRef.current.filter((item) => item.id !== id));
    },
    [commitQueue],
  );

  const pullQueuedMessage = useCallback(
    (id: string): string | null => {
      const item = queueRef.current.find((queued) => queued.id === id);
      if (!item) return null;
      commitQueue(queueRef.current.filter((queued) => queued.id !== id));
      return item.text;
    },
    [commitQueue],
  );

  const resumeQueue = useCallback(
    (navigate: NavigateFunction) => {
      lastNavigateRef.current = navigate;
      setPaused(false);
      const next = queueRef.current[0];
      if (next) startQueuedTurn(next);
    },
    [setPaused, startQueuedTurn],
  );

  // The refs `sendMessage`'s terminal paths and its error toast read. Assigned
  // in an effect because a ref must not be written during render.
  useEffect(() => {
    drainRef.current = drainNextQueued;
    submitRef.current = submitMessage;
  }, [drainNextQueued, submitMessage]);

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
    registerFocusComposer,
    quoteSelection,
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
    submitMessage,
    queue,
    queuePaused,
    removeQueuedMessage,
    pullQueuedMessage,
    resumeQueue,
    stopStreaming,
    refreshChats,
    deleteChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
