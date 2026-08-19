import { useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatContext } from "../../../context/ChatContext";

/**
 * localStorage key prefix for per-chat draft persistence (E10). Each chat's
 * in-progress message is stored under `chatDraft.<chatId>` so switching chats
 * restores the draft and it survives a page refresh. The "new chat" (no
 * chatId yet) state uses a shared `chatDraft.__new__` key.
 */
const DRAFT_KEY = (chatId: string | undefined) => `chatDraft.${chatId ?? "__new__"}`;

/**
 * Sentinel for "the draft ref has not been initialized yet", so the swap effect
 * below can tell a first run (mount — nothing to save, load the stored draft)
 * apart from a real chat switch. `undefined` can't be used: it's a valid chatId
 * value meaning "new chat".
 */
const DRAFT_UNINITIALIZED = Symbol("draftUninitialized");

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
  const prevLastContentLengthRef = useRef(0);

  const {
    messagesByChat,
    loadMessages,
    chats,
    sortedChats,
    chatsProjectId,
    selectedProjectId,
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
    sendMessage,
    stopStreaming,
    deleteChat: ctxDeleteChat,
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

  /**
   * Leaves a chat that does not belong to the selected project.
   *
   * Switching projects reloads the sidebar but leaves the route pointing at the chat that was
   * open, so it stayed on screen while being absent from the list. Gated on the list having
   * arrived for the *current* project — redirecting while it is still loading would throw the
   * user out of a chat that is perfectly valid.
   */
  useEffect(() => {
    if (!chatId) return;
    if (chatsProjectId !== selectedProjectId) return;
    if (chats.some((chat) => chat.id === chatId)) return;
    void navigate("/chat", { replace: true, state: { newChat: true } });
  }, [chatId, chats, chatsProjectId, selectedProjectId, navigate]);

  const messages = useMemo(() => {
    if (!chatId) return [];
    return messagesByChat[chatId] ?? [];
  }, [messagesByChat, chatId]);

  const activeChat = useMemo(() => {
    if (!chatId) return null;
    return chats.find((c) => c.id === chatId) ?? null;
  }, [chats, chatId]);

  /**
   * The provider's streaming flags are global (one stream at a time), so they
   * have to be attributed to the chat that started the stream before any UI
   * reads them. Ungated, the thinking indicator, the composer's busy state and
   * the stop button all follow the user into whatever chat they switch to —
   * and the stop button would abort a stream belonging to a different chat.
   */
  const isActiveChatStreaming = streamingChatId !== null && streamingChatId === chatId;

  const stopActiveStream = useCallback(() => {
    if (!isActiveChatStreaming) return;
    stopStreaming();
  }, [isActiveChatStreaming, stopStreaming]);

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

  // A5: Instead of reading scrollHeight/scrollTop on every token (which
  // forces a synchronous layout), an IntersectionObserver watches the bottom
  // anchor. When it's visible the user is "at the bottom" and we auto-scroll
  // on new content; when it's pushed out of view we stop auto-scrolling and
  // show a "jump to latest" button (E12).
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const anchor = bottomRef.current;
    const container = scrollContainerRef.current;
    if (!anchor || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The bottom anchor is a zero-height div; "intersecting" means
        // it's within the scroll viewport → the user is at the bottom.
        setIsAtBottom(entries[0]?.isIntersecting ?? true);
      },
      // The generous bottom margin is what keeps the "jump to latest" button from
      // flashing while sitting at the bottom: streamed content grows the container
      // faster than the smooth scroll follows, so an exact anchor drops out of view
      // for a frame or two on every token. Anything within this band still counts
      // as "at the bottom".
      { root: container, threshold: 0, rootMargin: "0px 0px 120px 0px" },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [bottomRef, scrollContainerRef]);

  // Auto-scroll: jump to the bottom on chat switch (instant) and when new
  // messages arrive *if* the user is already near the bottom. No DOM layout
  // reads here — driven entirely by the IntersectionObserver's `isAtBottom`.
  useEffect(() => {
    const chatChanged = chatId !== prevChatIdRef.current;
    const messageAdded = messages.length > prevMessageCountRef.current;
    // An uncached chat renders empty for one frame while `loadMessages`
    // is in flight, so the switch above jumps to the bottom of nothing.
    // Its history arriving is still part of opening the chat — without
    // this it counts as "new messages" and smooth-scrolls through the
    // entire thread.
    const wasEmpty = prevMessageCountRef.current === 0;

    // A streaming answer grows the last message instead of adding one, so tracking the
    // count alone left the view behind on any reply longer than the viewport.
    const lastContentLength = messages[messages.length - 1]?.content.length ?? 0;
    const contentGrew = lastContentLength > prevLastContentLengthRef.current;

    prevChatIdRef.current = chatId;
    prevMessageCountRef.current = messages.length;
    prevLastContentLengthRef.current = lastContentLength;

    if (chatChanged || (messageAdded && wasEmpty)) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }

    if (messageAdded && isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Instant, not smooth: this fires once per animation frame while tokens arrive, and
    // successive smooth scrolls would restart each other's animation and visibly stutter.
    if (contentGrew && isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [chatId, messages, isAtBottom]);

  /**
   * The most recent question the user asked in this chat, for the composer's history recall.
   * Reads from the rendered messages rather than a separate store, so it survives a reload
   * and always matches what is on screen.
   */
  const lastUserPrompt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "USER") return messages[i].content;
    }
    return "";
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // E10: Per-chat draft persistence to localStorage. When the user switches
  // chats, the current draft is saved under the old chatId and the new
  // chatId's draft is loaded — so in-progress text survives chat switching
  // and page refreshes. A debounced save keeps localStorage in sync while
  // the user types.
  // Starts uninitialized rather than at `chatId`: `newRequest` lives in the
  // provider and outlives this hook, so seeding it with the current chat made
  // the effect bail on mount — the stored draft was never loaded (a reload
  // then dropped it, because the debounce below saw an empty composer), and
  // arriving from another page carried the previous chat's text over and
  // overwrote the new chat's draft with it.
  const draftChatIdRef = useRef<string | undefined | typeof DRAFT_UNINITIALIZED>(
    DRAFT_UNINITIALIZED,
  );

  useEffect(() => {
    const prevChatId = draftChatIdRef.current;
    if (prevChatId === chatId) return;

    // Save the draft for the chat we're leaving, then load the new one.
    // On the first run there is no chat being left — only load.
    if (prevChatId !== DRAFT_UNINITIALIZED) {
      if (newRequest) {
        localStorage.setItem(DRAFT_KEY(prevChatId), newRequest);
      } else {
        localStorage.removeItem(DRAFT_KEY(prevChatId));
      }
    }

    draftChatIdRef.current = chatId;
    const saved = localStorage.getItem(DRAFT_KEY(chatId)) ?? "";
    setNewRequest(saved);
  }, [chatId, newRequest, setNewRequest]);

  // Debounced save while the user types (no chat switch).
  useEffect(() => {
    const id = setTimeout(() => {
      if (newRequest) {
        localStorage.setItem(DRAFT_KEY(chatId), newRequest);
      } else {
        localStorage.removeItem(DRAFT_KEY(chatId));
      }
    }, 400);
    return () => clearTimeout(id);
  }, [newRequest, chatId]);

  const addMessage = useCallback(
    (text: string) => {
      return sendMessage(chatId, text, navigate);
    },
    [sendMessage, chatId, navigate],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!newRequest.trim()) return;

      void addMessage(newRequest);
      setNewRequest("");
      // Clear the persisted draft once sent.
      localStorage.removeItem(DRAFT_KEY(chatId));

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.blur();
      }
    },
    [newRequest, addMessage, setNewRequest, chatId],
  );

  const deleteChat = useCallback(
    async (targetChatId: string) => {
      await ctxDeleteChat(targetChatId);
      if (targetChatId === chatId) {
        void navigate("/chat", { replace: true, state: { newChat: true } });
      }
    },
    [ctxDeleteChat, chatId, navigate],
  );

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
    stopStreaming: stopActiveStream,
    deleteChat,

    newRequest,
    setNewRequest,

    // Gated on `isActiveChatStreaming` — see the note above. Consumers get
    // "is *this* chat working", never "is any chat working".
    // Nothing can be asked without a project: retrieval is scoped to one, and the backend
    // rejects a chat that has none. Surfaced so the composer can say so instead of letting
    // the prompt vanish.
    hasProject: selectedProjectId !== "",

    lastUserPrompt,

    isThinking: isThinking && isActiveChatStreaming,
    isStreaming: isStreaming && isActiveChatStreaming,

    thinkingState: isActiveChatStreaming ? thinkingState : null,

    streamingMessageId: isActiveChatStreaming ? streamingMessageId : null,

    selectedCitation,
    setSelectedCitation,

    textareaRef,
    bottomRef,
    scrollContainerRef,

    isAtBottom,
    scrollToBottom,

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
  };
}
