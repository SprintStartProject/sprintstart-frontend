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
    return chats.find((c) => c.id === chatId) ?? null;
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
      { root: container, threshold: 0 },
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

    prevChatIdRef.current = chatId;
    prevMessageCountRef.current = messages.length;

    if (chatChanged) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }

    if (messageAdded && isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatId, messages, isAtBottom]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // E10: Per-chat draft persistence to localStorage. When the user switches
  // chats, the current draft is saved under the old chatId and the new
  // chatId's draft is loaded — so in-progress text survives chat switching
  // and page refreshes. A debounced save keeps localStorage in sync while
  // the user types.
  const draftChatIdRef = useRef<string | undefined>(chatId);

  useEffect(() => {
    const prevChatId = draftChatIdRef.current;
    if (prevChatId === chatId) return;

    // Save the draft for the chat we're leaving, then load the new one.
    if (newRequest) {
      localStorage.setItem(DRAFT_KEY(prevChatId), newRequest);
    } else {
      localStorage.removeItem(DRAFT_KEY(prevChatId));
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
