import { MessageSquareText, X } from "lucide-react";
import { ArrowDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { ArtifactViewerDrawer } from "../features/knowledge-base/components/ArtifactViewerDrawer.tsx";
import type { Artifact, ArtifactType, SourceSystem } from "../features/knowledge-base/types";
import type { SelectedCitation } from "../context/ChatContext.ts";
import {
  ConversationRail,
  RailToggle,
  RAIL_TOGGLE_CLEARANCE,
} from "../components/layout/ConversationRail.tsx";
import { MatrixRain } from "../features/easter-eggs/components/MatrixRain.tsx";
import { useNewConversationShortcut } from "../hooks/useNewConversationShortcut.ts";
import { surfaceFromPathname } from "../components/common/assistantSurfaces.ts";

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
    promptHistory,
    handleSubmit,
    stopStreaming,
    deleteChat,
    isThinking,
    isStreaming,
    thinkingState,
    streamingMessageId,
    newRequest,
    setNewRequest,
    isRailOpen,
    setRailOpen,
    isRailOverlay,
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
  const citationArtifact = useMemo(
    () => (viewingCitationArtifact ? deriveArtifactFromCitation(viewingCitationArtifact) : null),
    [viewingCitationArtifact],
  );

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

  /**
   * Focuses the composer and puts the caret behind whatever is already in it.
   *
   * A textarea focused with a value in it starts the caret at position 0, so a question handed
   * over from the dashboard had the user typing *in front of* it. Deferred to the next frame
   * because the value arrives with React's commit — measuring or selecting against the previous
   * one clamps the caret back to where the old text ended. Same idiom as the composer's own
   * arrow-up recall.
   */
  const focusComposerAtEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;

      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
  }, [textareaRef]);

  // Focus textarea when opening a new chat (empty state).
  useEffect(() => {
    if (!chatId) {
      focusComposerAtEnd();
    }
  }, [chatId, focusComposerAtEnd]);

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
      // Same treatment as an arriving question: the chip fills the composer, and the caret
      // belongs after the text so it can simply be added to.
      focusComposerAtEnd();
    },
    [setNewRequest, focusComposerAtEnd],
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

  // The keyboard half of the sidebar's "New Chat" — the same navigation, `state.newChat` and
  // all, because that flag is what stops `useChat` redirecting straight back into the most
  // recent conversation.
  const navigate = useNavigate();
  const startNewChat = useCallback(
    () => void navigate("/chat", { state: { newChat: true } }),
    [navigate],
  );

  // Only while this is the half on screen. `AssistantShell` keeps the page being left mounted
  // for the length of the slide, so without this both halves would answer the one keypress —
  // see `surfaceFromPathname`.
  const { pathname } = useLocation();

  useNewConversationShortcut(startNewChat, surfaceFromPathname(pathname) === "chat");

  return (
    // No height of its own any more: the page is a panel inside `AssistantShell`, which owns
    // the viewport and the header above it.
    <div className="flex min-h-0 flex-1 overflow-hidden text-app-text">
      {/* One rail for both widths: a drawer over the conversation on a phone, a column beside
                it from `md` up. It used to be two asides rendering the same list, one hidden per
                breakpoint — the chat list stood twice in the document, which is invisible on the
                page and a plain duplicate to a screen reader, the browser's own find, and any
                selector. The buddy's PM replies run on the same component. */}
      <ConversationRail
        id="chat-history"
        isOpen={isRailOpen}
        label="Chat history"
        openWidthClassName="md:w-64"
        onDismiss={() => setRailOpen(false)}
        // The same words the cross inside it uses, so the backdrop and the button are not two
        // different-sounding ways to do one thing.
        dismissLabel="Close the conversation list"
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold tracking-wide text-app-text-muted uppercase">Chats</h2>
          <button
            type="button"
            aria-label="Close the conversation list"
            onClick={() => setRailOpen(false)}
            className="rounded p-1 text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatSidebar
            chats={chats}
            // Only the drawer has to get out of the way after a chat is picked. Closing the
            // column too would mean the list put itself away every time it was used.
            onNavigate={() => {
              if (isRailOverlay) setRailOpen(false);
            }}
            onDeleteChat={deleteChat}
          />
        </div>
      </ConversationRail>

      {/* Main content column */}
      <div
        /* The separating space belongs *before* `${`, never inside the string:
           prettier-plugin-tailwindcss trims class strings when it sorts them,
           which once silently glued `flex-col` to the rail class and
           turned the whole page into a flex row. */
        // `min-h-0` because this is now a flex item inside the shell's column rather than a
        // child of its own fixed-height page: without it the transcript would grow the column
        // instead of scrolling inside it.
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isRailOpen ? "app-rail-open" : ""}`}
      >
        {/* The way back to the conversation list, floating over the top of the transcript
                    rather than sitting in a bar of its own. The page header belongs to
                    `AssistantShell` now, and a strip under it holding nothing but one toggle
                    would be a second header for a single button. The transcript pads itself out
                    from under it — see `RAIL_TOGGLE_CLEARANCE` below. */}
        {!isRailOpen && (
          <RailToggle
            label="Show your conversations"
            controls="chat-history"
            icon={<MessageSquareText size={18} />}
            onClick={() => setRailOpen(true)}
          />
        )}

        <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto">
          {!chatId && <ChatEmptyState onPickSuggestion={fillSuggestion} />}

          {/* E5: deliberately NOT a live region. Marking the message
                        list `aria-live` made screen readers re-announce the
                        whole answer on every streamed token; the sr-only
                        status node below announces the end of a turn instead. */}
          {/* Room for the floating toggle, and only while there is one to make room for —
                        see `RAIL_TOGGLE_CLEARANCE`, which the buddy's transcript reads from the
                        same place. With the rail open on a phone nothing floats over this column
                        and the page's own padding stands. */}
          <div
            className={`app-page-frame flex w-full flex-col gap-8 pb-8 ${
              isRailOpen ? "pt-8" : RAIL_TOGGLE_CLEARANCE
            }`}
          >
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
          promptHistory={promptHistory}
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

      {citationArtifact && projectId && (
        <ArtifactViewerDrawer
          artifact={citationArtifact}
          onClose={() => setViewingCitationArtifact(null)}
          projectId={projectId}
          highlightLines={viewingCitationArtifact?.lines}
          canDelete={false}
          onDelete={() => {}}
        />
      )}

      {isMatrixActive && <MatrixRain onClose={() => setIsMatrixActive(false)} />}
    </div>
  );
}
