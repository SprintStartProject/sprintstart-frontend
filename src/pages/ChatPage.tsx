import { MessageSquareText, Sparkles, X } from "lucide-react";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { centralSpringToken } from "../styles/tokens";
import { useChat } from "../features/chatbot/hooks/useChat.ts";
import { useAvailableSources } from "../features/chatbot/hooks/useAvailableSources.ts";
import { useAuth } from "../context/useAuth";
import { useProjectContext } from "../features/projects/useProjectContext";
import { ChatSidebar } from "../features/chatbot/components/ChatSidebar.tsx";
import { MessageRow } from "../features/chatbot/components/MessageRow.tsx";
import { ThinkingIndicator } from "../features/chatbot/components/ThinkingIndicator.tsx";
import { CitationPopover } from "../features/chatbot/components/CitationPopover.tsx";
import { ChatEmptyState } from "../features/chatbot/components/ChatEmptyState.tsx";
import { ChatComposer } from "../features/chatbot/components/ChatComposer.tsx";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { ArtifactViewerDrawer } from "../features/knowledge-base/components/ArtifactViewerDrawer.tsx";
import type { Artifact, ArtifactType, SourceSystem } from "../features/knowledge-base/types";
import type { SelectedCitation } from "../context/ChatContext.ts";
import { MatrixRain } from "../features/easter-eggs/components/MatrixRain.tsx";

import "katex/dist/katex.min.css";

type CitationArtifactOpen = {
  artifactId: string;
  filename: string;
  sourceUrl?: string;
  lines: number[];
};

function deriveArtifactFromCitation(citation: CitationArtifactOpen): Artifact {
  const url = citation.sourceUrl?.toLowerCase() ?? "";
  const name = citation.filename.toLowerCase();

  let artifactType: ArtifactType = "FILE";
  if (url.includes("/pull/") || name.startsWith("pr #") || name.startsWith("pull request")) {
    artifactType = "PULL_REQUEST";
  } else if (
    url.includes("/issues/") ||
    url.includes("/browse/") ||
    name.startsWith("issue #") ||
    name.startsWith("jira #")
  ) {
    artifactType = "ISSUE";
  }

  let sourceSystem: SourceSystem = "GITHUB";
  if (url.includes("atlassian.net") || url.includes("/browse/") || name.startsWith("jira #")) {
    sourceSystem = "JIRA";
  }

  const isMarkdown =
    artifactType === "ISSUE" ||
    artifactType === "PULL_REQUEST" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown");

  return {
    id: citation.artifactId,
    title: citation.filename,
    artifactType,
    sourceSystem,
    sourceId: "",
    sourceUrl: citation.sourceUrl || null,
    mime: isMarkdown ? "text/markdown" : "text/plain",
    language: isMarkdown ? "Markdown" : null,
    ingestedAt: new Date().toISOString(),
    createdAtSource: null,
    updatedAtSource: null,
    contentHash: null,
    ingestionRunId: null,
  };
}

/**
 * Displays the interface for communication with the chat.
 */
export function ChatPage() {
  const { profile } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const {
    messages,
    chatId,
    chats,
    activeChat,
    hasProject,
    lastUserPrompt,
    handleSubmit,
    stopStreaming,
    isThinking,
    isStreaming,
    thinkingState,
    streamingMessageId,
    newRequest,
    setNewRequest,
    sidebarOpen,
    setSidebarOpen,
    desktopSidebarOpen,
    setDesktopSidebarOpen,
    textareaRef,
    bottomRef,
    selectedCitation,
    setSelectedCitation,
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
    scrollContainerRef,
    isAtBottom,
    scrollToBottom,
  } = useChat();

  const { sources: availableSources, loading: sourcesLoading } = useAvailableSources();

  // Resolved from the chat, not from the switcher: a citation points at an artifact
  // of the project the conversation belongs to. Taking the currently selected project
  // instead made citations in an older chat 404 as soon as the user switched projects.
  // Only the empty state (no chat open yet) falls back to the selection.
  const projectId = activeChat?.projectId ?? selectedProjectId ?? profile?.projectIds?.[0] ?? null;
  const [viewingCitationArtifact, setViewingCitationArtifact] =
    useState<CitationArtifactOpen | null>(null);

  // Easter egg states
  const [isBarrelRolling, setIsBarrelRolling] = useState(false);
  const [isMatrixActive, setIsMatrixActive] = useState(false);

  // Custom submit handler to intercept easter eggs
  const handleChatSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const text = newRequest.trim().toLowerCase();
      if (text === "do a barrel roll" || text === "do barrel roll" || text === "do barrel") {
        e.preventDefault();
        setIsBarrelRolling(true);
        setNewRequest("");
        return;
      }
      if (text === "the matrix" || text === "do matrix" || text === "matrix") {
        e.preventDefault();
        setIsMatrixActive(true);
        setNewRequest("");
        return;
      }
      handleSubmit(e);
    },
    [newRequest, setNewRequest, handleSubmit],
  );

  // Barrel roll side-effect
  useEffect(() => {
    if (isBarrelRolling) {
      document.body.classList.add("barrel-roll-active");
      const timeout = setTimeout(() => {
        document.body.classList.remove("barrel-roll-active");
        setIsBarrelRolling(false);
      }, 2000);
      return () => {
        clearTimeout(timeout);
        document.body.classList.remove("barrel-roll-active");
      };
    }
  }, [isBarrelRolling]);

  // Dino easter egg: while the assistant is thinking, pressing Space drops the
  // AI avatar into a tiny endless runner. Doing nothing leaves the chat untouched.
  const [gameActive, setGameActive] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(
    () => localStorage.getItem("dinoUnlocked") === "true",
  );

  // Close the game as soon as the answer arrives. Uses React's documented
  // "adjust state when a value changes" pattern (guarded setState during
  // render) instead of an effect — avoids cascading renders and the
  // set-state-in-effect lint rule. See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevIsThinking, setPrevIsThinking] = useState(isThinking);
  if (prevIsThinking !== isThinking) {
    setPrevIsThinking(isThinking);
    if (!isThinking && gameActive) {
      setGameActive(false);
    }
  }

  // E5: replacement for the live region that used to wrap the message list.
  // `ThinkingIndicator` already carries `role="status"` for the working
  // state, so this only needs to report that a turn has finished. Gated on
  // the chat id as well: switching away from a streaming chat also clears
  // the busy flags, and that must not be announced as a finished answer.
  const busy = isThinking || isStreaming;
  const [announcement, setAnnouncement] = useState("");
  const [prevTurn, setPrevTurn] = useState({ chatId, busy });
  if (prevTurn.chatId !== chatId || prevTurn.busy !== busy) {
    const finished = prevTurn.chatId === chatId && prevTurn.busy && !busy;
    setPrevTurn({ chatId, busy });
    setAnnouncement(finished ? "Response complete." : "");
  }

  // Submitting blurs the composer so Space can start the dino game while the assistant
  // works. Once the turn is over that reason is gone, so focus goes back — otherwise every
  // follow-up question needs a click first. Skipped when something else already holds focus,
  // so this never steals the caret from wherever the user went in the meantime.
  useEffect(() => {
    if (busy) return;
    if (!chatId) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    textareaRef.current?.focus();
  }, [busy, chatId, textareaRef]);

  // Keep isUnlocked state perfectly in sync with localStorage and close game if locked
  useEffect(() => {
    const handleUnlockChange = () => {
      const unlocked = localStorage.getItem("dinoUnlocked") === "true";
      setIsUnlocked(unlocked);
      if (!unlocked) {
        setGameActive(false);
      }
    };
    window.addEventListener("dinoUnlockChanged", handleUnlockChange);
    window.addEventListener("storage", handleUnlockChange);
    return () => {
      window.removeEventListener("dinoUnlockChanged", handleUnlockChange);
      window.removeEventListener("storage", handleUnlockChange);
    };
  }, []);

  useEffect(() => {
    if (!isThinking || gameActive || !isUnlocked) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      // Don't hijack space while the user is typing their next message.
      const active = document.activeElement;
      const typing =
        active instanceof HTMLElement &&
        (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable);
      if (typing) return;

      e.preventDefault();
      setGameActive(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isThinking, gameActive, isUnlocked]);

  // Focus textarea when opening a new chat (empty state).
  useEffect(() => {
    if (!chatId) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [chatId, textareaRef]);

  // Scroll the freshly-started game into view, even if the user was scrolled up.
  useEffect(() => {
    if (gameActive) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameActive, bottomRef]);

  // E9: "/" focuses the composer (like Slack/GitHub) when the user isn't
  // already typing in a field. Escape blurs it to return to the page.
  useEffect(() => {
    const isTypingTarget = (el: Element | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTypingTarget(document.activeElement)) {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [textareaRef]);

  const fillSuggestion = useCallback(
    (text: string) => {
      setNewRequest(text);
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    },
    [setNewRequest, textareaRef],
  );

  // Stable callbacks for the memoized MessageRow — referential equality
  // across renders is what lets unchanged rows bail out of re-rendering.
  const handleCitationClick = useCallback(
    (citation: SelectedCitation) => setSelectedCitation(citation),
    [setSelectedCitation],
  );
  const handleOpenArtifact = useCallback(
    (data: CitationArtifactOpen) => setViewingCitationArtifact(data),
    [],
  );
  const profileFallbackName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "User";

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden text-app-text lg:h-screen">
      {/* Mobile slide-out drawer — slides in from the left on mobile */}
      <aside
        id="chat-mobile-sidebar"
        aria-label="Mobile chat navigation"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={[
          "fixed top-0 left-0 z-50 h-full w-64 bg-app-bg-soft",
          "border-r border-app-border shadow-2xl",
          "transform transition-transform duration-300 md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between p-4">
          <h2 className="font-bold">Chats</h2>
          <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
      </aside>

      {/* Mobile toggle button — top-right so it doesn't overlap the mobile header burger */}
      <button
        aria-label="Toggle sidebar"
        aria-controls="chat-mobile-sidebar"
        aria-expanded={sidebarOpen}
        className="fixed top-4 right-[var(--app-page-gutter)] z-50 mt-15 rounded-full border border-app-border bg-app-surface p-3 text-app-text shadow-lg hover:cursor-pointer hover:bg-app-surface-hover md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <MessageSquareText size={24} />
      </button>

      {/* Desktop chat history sidebar — LEFT side, always rendered */}
      <aside
        aria-label="Chat history"
        className={[
          "hidden shrink-0 flex-col border-r border-app-border bg-app-bg-soft transition-all duration-200 md:flex",
          desktopSidebarOpen ? "w-64" : "w-0 overflow-hidden border-r-0",
        ].join(" ")}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold tracking-wide text-app-text-muted uppercase">Chats</h2>
          <button
            aria-label="Close sidebar"
            onClick={() => setDesktopSidebarOpen(false)}
            className="text-app-text-muted transition-colors hover:text-app-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <ChatSidebar chats={chats} setSidebarOpen={() => {}} />
        </div>
      </aside>

      {/* Main content column */}
      <div
        /* The separating space belongs *before* `${`, never inside the string:
           prettier-plugin-tailwindcss trims class strings when it sorts them,
           which once silently glued `flex-col` to `chat-sidebar-open` and
           turned the whole page into a flex row. */
        className={`relative flex min-w-0 flex-1 flex-col ${desktopSidebarOpen ? "chat-sidebar-open" : ""}`}
      >
        {/* Header: open-sidebar toggle floats at the far-left edge so it
                    doesn't crowd the page title's icon; title stays aligned with
                    the message column below (toggle is out of flow). */}
        <div className="app-page-frame relative flex shrink-0 items-center border-b border-app-border bg-app-bg/80 py-3 backdrop-blur-md">
          {!desktopSidebarOpen && (
            <button
              aria-label="Open sidebar"
              onClick={() => setDesktopSidebarOpen(true)}
              className="absolute top-1/2 left-2 hidden shrink-0 -translate-y-1/2 items-center justify-center rounded-xl border border-app-border bg-app-surface p-2 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text md:flex"
            >
              <MessageSquareText size={18} />
            </button>
          )}
          <PageHeader
            icon={Sparkles}
            title="AI Assistant"
            subtitle="Ask questions about project knowledge, code, documentation and onboarding."
            hideSubtitleBelow="md"
            className="flex-1"
          />
        </div>

        <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto">
          {!chatId && <ChatEmptyState onPickSuggestion={fillSuggestion} />}

          {/* E5: deliberately NOT a live region. Marking the message
                        list `aria-live` made screen readers re-announce the
                        whole answer on every streamed token; the sr-only
                        status node below announces the end of a turn instead. */}
          <div className="app-page-frame flex w-full flex-col gap-8 py-8">
            {/* E1: AnimatePresence wraps dynamically added/removed
                            message rows so enter/exit animate smoothly (chat
                            switch, new messages). Per AGENTS.md §11. */}
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={centralSpringToken}
                >
                  <MessageRow
                    message={message}
                    showDivider={
                      index > 0 &&
                      messages[index - 1].role === "ASSISTANT" &&
                      message.role === "ASSISTANT"
                    }
                    isThinking={isThinking}
                    isStreaming={isStreaming}
                    streamingMessageId={streamingMessageId}
                    profileIcon={profile?.profileIcon ?? undefined}
                    profileFallbackName={profileFallbackName}
                    profileSeed={profile?.id ?? undefined}
                    onCitationClick={handleCitationClick}
                    onOpenArtifact={handleOpenArtifact}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            <ThinkingIndicator
              isThinking={isThinking}
              gameActive={gameActive}
              thinkingState={thinkingState}
              onGameExit={() => setGameActive(false)}
            />

            <div className="sr-only" role="status" aria-live="polite">
              {announcement}
            </div>

            <div ref={bottomRef} />
          </div>
        </div>

        {selectedCitation && (
          <CitationPopover
            selected={selectedCitation}
            onClose={() => setSelectedCitation(null)}
            onOpenArtifact={handleOpenArtifact}
          />
        )}

        {/* E12: floating "jump to latest" button — shown when the user
                     has scrolled up during streaming so they can return quickly. */}
        {chatId && !isAtBottom && (
          <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
            <button
              type="button"
              aria-label="Jump to latest message"
              data-testid="chat-scroll-to-bottom"
              onClick={scrollToBottom}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text shadow-lg transition-colors hover:bg-app-surface-hover"
            >
              <ArrowDown size={14} />
              Latest
            </button>
          </div>
        )}

        <ChatComposer
          value={newRequest}
          onChange={setNewRequest}
          onSubmit={handleChatSubmit}
          onStop={stopStreaming}
          isBusy={isThinking || isStreaming}
          hasProject={hasProject}
          lastUserPrompt={lastUserPrompt}
          availableSources={availableSources}
          sourcesLoading={sourcesLoading}
          textareaRef={textareaRef}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((v) => !v)}
          from={from}
          setFrom={setFrom}
          to={to}
          setTo={setTo}
          sourceSystems={sourceSystems}
          toggleSourceSystem={toggleSourceSystem}
          activeFilterCount={activeFilterCount}
          clearFilters={clearFilters}
        />
      </div>

      {viewingCitationArtifact && projectId && (
        <ArtifactViewerDrawer
          artifact={deriveArtifactFromCitation(viewingCitationArtifact)}
          onClose={() => setViewingCitationArtifact(null)}
          projectId={projectId}
          highlightLines={viewingCitationArtifact.lines}
          canDelete={false}
          onDelete={() => {}}
        />
      )}

      {isMatrixActive && <MatrixRain onClose={() => setIsMatrixActive(false)} />}
    </div>
  );
}
