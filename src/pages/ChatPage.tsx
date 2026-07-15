import { Bot, Check, ExternalLink, Filter, MessageSquareText, Plus, Send, Sparkles, X } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useChat } from "../features/chatbot/hooks/useChat.ts";
import { useAuth } from "../context/useAuth";
import { UserAvatar } from "../components/common/UserAvatar.tsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatSidebar } from "../features/chatbot/components/ChatSidebar.tsx";
import { MessageCitations } from "../features/chatbot/components/MessageCitations.tsx";
import { CopyButton } from "../features/chatbot/components/CopyButton.tsx";
import { DinoGame } from "../features/chatbot/components/DinoGame.tsx";
import { linkifyCitations } from "../features/chatbot/markdown/linkifyCitations.ts";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { SOURCE_SYSTEMS } from "../features/chatbot/types.ts";

import "katex/dist/katex.min.css";

const SUGGESTIONS = [
    "How do I set up the project locally?",
    "Explain the onboarding flow",
    "Where is the authentication handled?"
];

/**
 * Displays the interface for communication with the chat.
 */
export function ChatPage() {
    const { profile } = useAuth();
    const {
        messages,
        chatId,
        chats,
        handleSubmit,
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
        scrollContainerRef
    } = useChat();

    // Dino easter egg: while the assistant is thinking, pressing Space drops the
    // AI avatar into a tiny endless runner. Doing nothing leaves the chat untouched.
    const [gameActive, setGameActive] = useState(false);

    // Close the game as soon as the answer arrives (and on chat switches).
    if (gameActive && !isThinking) {
        setGameActive(false);
    }

    useEffect(() => {
        if (!isThinking || gameActive) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;

            // Don't hijack space while the user is typing their next message.
            const active = document.activeElement;
            const typing =
                active instanceof HTMLElement &&
                (active.tagName === "TEXTAREA" ||
                    active.tagName === "INPUT" ||
                    active.isContentEditable);
            if (typing) return;

            e.preventDefault();
            setGameActive(true);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isThinking, gameActive]);

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

    const fillSuggestion = (text: string) => {
        setNewRequest(text);
        const el = textareaRef.current;
        if (el) {
            el.focus();
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-app-bg text-app-text lg:h-screen">
            {/* Mobile slide-out drawer — slides in from the right on mobile */}
            <aside
                id="chat-mobile-sidebar"
                aria-label="Mobile chat navigation"
                aria-hidden={!sidebarOpen}
                inert={!sidebarOpen}
                className={[
                    "fixed top-0 right-0 z-50 h-full w-64 bg-app-bg-soft",
                    "border-l border-app-border shadow-2xl",
                    "transform transition-transform duration-300 md:hidden",
                    sidebarOpen ? "translate-x-0" : "translate-x-full",
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

            {/* Mobile toggle button — top-left so it doesn't overlap the mobile header burger */}
            <button
                aria-label="Toggle sidebar"
                aria-controls="chat-mobile-sidebar"
                aria-expanded={sidebarOpen}
                className="
                    fixed top-4 left-[var(--app-page-gutter)] z-50 mt-15
                    rounded-full border border-app-border bg-app-surface
                    p-3 text-app-text shadow-lg
                    hover:cursor-pointer hover:bg-app-surface-hover
                    md:hidden
                "
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <MessageSquareText size={24} />
            </button>

            {/* Main content column */}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Header: page title + open-sidebar toggle on the right */}
                <div className="flex shrink-0 items-center gap-2 border-b border-app-border bg-app-bg/80 app-page-frame py-3 backdrop-blur-md">
                    <PageHeader
                        icon={Sparkles}
                        title="AI Assistant"
                        subtitle="Ask questions about project knowledge, code, documentation and onboarding."
                        hideSubtitleBelow="md"
                        className="flex-1"
                    />
                    {!desktopSidebarOpen && (
                        <button
                            aria-label="Open sidebar"
                            onClick={() => setDesktopSidebarOpen(true)}
                            className="hidden md:flex items-center justify-center rounded-xl border border-app-border bg-app-surface p-2 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text transition-colors shrink-0"
                        >
                            <MessageSquareText size={18} />
                        </button>
                    )}
                </div>

                <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto">
                    {!chatId && (
                        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                            <div className="mb-5 rounded-3xl bg-app-brand-soft p-4 ring-1 ring-app-brand-border">
                                <Bot className="size-11 text-app-brand-text" />
                            </div>

                            <h1 className="mb-2 text-2xl font-bold text-app-text">
                                How can I help you today?
                            </h1>

                            <p className="mb-6 max-w-md text-sm text-app-text-muted">
                                Ask anything about your project&apos;s codebase, documentation, or
                                onboarding process.
                            </p>

                            <div className="flex max-w-xl flex-wrap justify-center gap-2">
                                {SUGGESTIONS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => fillSuggestion(s)}
                                        className="rounded-full border border-app-border-muted bg-app-surface px-3.5 py-1.5 text-xs text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div
                        className="app-page-frame flex w-full flex-col gap-8 py-8"
                        aria-live="polite"
                        aria-atomic="false"
                    >
                        {messages.map((message, index) => {
                            const isRequest = message.role === "USER";

                            // Subtle divider between consecutive assistant turns so long
                            // answers don't blur together.
                            const prevAssistant =
                                index > 0 &&
                                messages[index - 1].role === "ASSISTANT" &&
                                message.role === "ASSISTANT";

                            if (
                                message.role === "ASSISTANT" &&
                                message.content === "" &&
                                isThinking
                            ) {
                                return null;
                            }

                            const citations = message.citations ?? [];
                            const mdContent = isRequest
                                ? message.content
                                : linkifyCitations(message.content, citations.length);

                            // Show a blinking caret at the end of the assistant
                            // message that is currently receiving streamed tokens.
                            const showStreamingCaret =
                                !isRequest &&
                                isStreaming &&
                                message.id === streamingMessageId;

                            return (
                                <Fragment key={index}>
                                    {prevAssistant && (
                                        <div className="mx-auto w-3/4 border-t border-app-border-muted" />
                                    )}
                                    <div
                                        className={`flex w-full gap-3 ${
                                            isRequest ? "flex-row-reverse" : "flex-row"
                                        }`}
                                    >
                                    <div
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                                            isRequest
                                                ? ""
                                                : "bg-app-brand-soft shadow-sm ring-1 ring-app-brand-border"
                                        }`}
                                    >
                                        {isRequest ? (
                                            <UserAvatar
                                                profileIcon={profile?.profileIcon}
                                                fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : "User"}
                                                seed={profile?.id}
                                                size={32}
                                            />
                                        ) : (
                                            <Bot size={15} className="text-app-brand-text" />
                                        )}
                                    </div>

                                    <div
                                        className={`flex flex-col ${
                                            isRequest ? "max-w-[70%] items-end" : "max-w-[85%] items-start"
                                        }`}
                                    >
                                        <div
                                            className={`chat-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                                                isRequest
                                                    ? "chat-md-user rounded-tr-sm bg-app-brand text-white"
                                                    : "rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text"
                                            }`}
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                    a({ href, children }: { href?: string; children?: React.ReactNode }) {
                                                        const match = href
                                                            ? /^#cite-(\d+)$/.exec(href)
                                                            : null;

                                                        if (match) {
                                                            const n = Number(match[1]);
                                                            const citation = citations[n - 1];
                                                            return (
                                                                <sup
                                                                    className="citation-ref"
                                                                    title={citation ? citation.filename : `Quelle ${n}`}
                                                                >
                                                                    {n}
                                                                </sup>
                                                            );
                                                        }

                                                        return (
                                                            <a href={href} target="_blank" rel="noopener noreferrer">
                                                                {children}
                                                            </a>
                                                        );
                                                    },
                                                    table: ({ children }) => (
                                                        <div className="overflow-x-auto">
                                                            <table className={`w-full border-collapse border-2 my-3 ${isRequest ? "border-app-brand-border" : "border-app-border-muted"}`}>
                                                                {children}
                                                            </table>
                                                        </div>
                                                    ),
                                                    th: ({ children }) => (
                                                        <th className={`border-2 px-3 py-2 text-left ${isRequest ? "border-app-brand-border bg-app-brand-soft" : "border-app-border-muted bg-app-surface"}`}>
                                                            {children}
                                                        </th>
                                                    ),
                                                    td: ({ children }) => (
                                                        <td className={`border-2 px-3 py-2 ${isRequest ? "border-app-brand-border" : "border-app-border-muted"}`}>
                                                            {children}
                                                        </td>
                                                    ),
                                                    code({ children, className }: { children?: React.ReactNode; className?: string }) {

                                                        const isBlock = className?.startsWith("language-");

                                                        if (!isBlock) {
                                                            return (
                                                                <code className={`px-1 py-0.5 mx-0.5 rounded border ${isRequest ? "bg-app-brand-soft border-app-brand-border" : "bg-app-surface border-app-border-muted"}`}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }

                                                        return (
                                                            <code className={className}>
                                                                {children}
                                                            </code>
                                                        );
                                                    },
                                                    pre(props) {
                                                        return (
                                                            <pre
                                                                className={`
                                                                    p-3
                                                                    my-3
                                                                    rounded-xl
                                                                    overflow-x-auto
                                                                    border
                                                                    ${isRequest ? "bg-app-brand-soft border-app-brand-border" : "bg-app-surface border-app-border-muted"}
                                                                `}
                                                            >
                                                                {props.children}
                                                            </pre>
                                                        );
                                                    }
                                                }}>
                                                {mdContent}
                                            </ReactMarkdown>

                                            {showStreamingCaret && (
                                                <span
                                                    className="streaming-caret"
                                                    aria-hidden="true"
                                                />
                                            )}

                                            {!isRequest && citations.length > 0 && (
                                                <MessageCitations citations={citations} />
                                            )}
                                        </div>

                                        {!isRequest && !showStreamingCaret && message.content !== "" && (
                                            <CopyButton text={message.content} />
                                        )}
                                    </div>
                                    </div>
                                </Fragment>
                            );
                        })}

                        {gameActive && isThinking ? (
                            <div className="flex w-full gap-3" aria-hidden="true">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-brand-soft shadow-sm ring-1 ring-app-brand-border">
                                    <Bot size={15} className="text-app-brand-text" />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <DinoGame onExit={() => setGameActive(false)} />
                                    
                                    <div className="mt-2 px-4 py-2.5 rounded-2xl bg-app-surface-muted text-app-text flex items-center gap-1 w-max border border-app-border-muted">
                                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce" />
                                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:150ms]" />
                                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:300ms]" />

                                        {thinkingState === "retrieve" && (
                                            <span className="italic pl-2 animate-pulse text-sm">Searching knowledge base...</span>
                                        )}
                                        {thinkingState === "synthesis" && (
                                            <span className="italic pl-2 animate-pulse text-sm">Synthesizing answer...</span>
                                        )}
                                        {thinkingState === "grep" && (
                                            <span className="italic pl-2 animate-pulse text-sm">Scanning documents...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            isThinking && (
                                <div className="flex w-full gap-3" aria-hidden="true">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-brand-soft shadow-sm ring-1 ring-app-brand-border">
                                        <Bot size={15} className="text-app-brand-text" />
                                    </div>

                                    <div className="flex flex-col items-start max-w-[85%]">
                                        <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text">
                                            <div className="flex gap-1 items-center">
                                                <span className="size-2 animate-bounce rounded-full bg-app-brand" />
                                                <span className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                                                <span className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />

                                                {thinkingState === "retrieve" && (
                                                    <span className="italic pl-2 animate-pulse text-sm">Searching knowledge base...</span>
                                                )}

                                                {thinkingState === "synthesis" && (
                                                    <span className="italic pl-2 animate-pulse text-sm">Synthesizing answer...</span>
                                                )}

                                                {thinkingState === "grep" && (
                                                    <span className="italic pl-2 animate-pulse text-sm">Scanning documents...</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        <div ref={bottomRef} />
                    </div>
                </div>

                {selectedCitation && (
                    <div className="absolute right-6 bottom-24 w-80 rounded-xl bg-app-surface border border-app-border p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-bold text-app-text truncate pr-4">
                                {selectedCitation.sourceUrl ? (
                                    <a
                                        href={selectedCitation.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 hover:underline"
                                    >
                                        {selectedCitation.filename}
                                        <ExternalLink size={12} />
                                    </a>
                                ) : (
                                    selectedCitation.filename
                                )}
                            </h3>

                            <button
                                aria-label="Close citation"
                                onClick={() => setSelectedCitation(null)}
                                className="text-app-text-muted hover:text-app-text transition-colors"
                            >
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>

                        <div className="text-xs text-app-text-muted leading-relaxed">
                            {selectedCitation.startLine !== undefined && `Line ${selectedCitation.startLine}`}
                            {selectedCitation.startPage !== undefined && `Page ${selectedCitation.startPage}`}
                        </div>
                    </div>
                )}

                <footer className="shrink-0 border-t border-app-border bg-app-bg app-page-frame py-4">
                    {showFilters && (
                        <div className="mb-3">
                            <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-app-border bg-app-surface-muted/70 backdrop-blur px-4 py-3">

                                <div className="flex flex-col gap-1">
                                    <label
                                        htmlFor="filter-from"
                                        className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold"
                                    >
                                        From
                                    </label>

                                    <input
                                        id="filter-from"
                                        type="date"
                                        max={to || undefined}
                                        value={from}
                                        onChange={(e) => setFrom(e.target.value)}
                                        className="
                                            h-10 rounded-xl
                                            border border-app-border
                                            bg-app-bg
                                            px-3
                                            text-sm
                                            outline-none
                                            focus:ring-2 focus:ring-app-focus/50
                                        "
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label
                                        htmlFor="filter-to"
                                        className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold"
                                    >
                                        To
                                    </label>

                                    <input
                                        id="filter-to"
                                        type="date"
                                        min={from || undefined}
                                        value={to}
                                        onChange={(e) => setTo(e.target.value)}
                                        className="
                                            h-10 rounded-xl
                                            border border-app-border
                                            bg-app-bg
                                            px-3
                                            text-sm
                                            outline-none
                                            focus:ring-2 focus:ring-app-focus/50
                                        "
                                    />
                                </div>

                                <div className="h-8 w-px bg-app-border-muted self-center hidden lg:block" />

                                <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold">
                                            Systems
                                        </span>
                                        {activeFilterCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={clearFilters}
                                                className="text-xs font-semibold text-app-text-muted hover:text-app-brand transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>

                                    <div
                                        role="group"
                                        aria-label="Source systems"
                                        className="flex flex-wrap gap-2 min-h-10 items-center"
                                    >
                                        {SOURCE_SYSTEMS.map((source) => {
                                            const selected = sourceSystems.includes(source);

                                            return (
                                                <button
                                                    key={source}
                                                    type="button"
                                                    aria-pressed={selected}
                                                    onClick={() => toggleSourceSystem(source)}
                                                    className={`
                                                        h-10
                                                        rounded-full
                                                        px-4
                                                        text-xs
                                                        font-semibold
                                                        uppercase
                                                        tracking-wide
                                                        border
                                                        transition-colors
                                                        flex
                                                        items-center
                                                        gap-1.5
                                                        ${
                                                            selected
                                                                ? "bg-app-brand text-white border-app-brand"
                                                                : "bg-app-bg border-app-border text-app-text hover:bg-app-surface"
                                                        }
                                                    `}
                                                >
                                                    {selected && <Check size={13} />}
                                                    {source}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="flex items-end gap-2 rounded-2xl border border-app-border-muted bg-app-surface-muted p-2 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
                    >
                        <button
                            type="button"
                            aria-label="Toggle source filters"
                            aria-expanded={showFilters}
                            onClick={() => setShowFilters((v) => !v)}
                            className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-surface border border-app-border-muted text-app-text-muted hover:bg-app-surface-hover hover:text-app-text transition-colors"
                        >
                            <Filter size={18} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-app-brand text-[10px] font-bold text-white shadow-sm ring-1 ring-app-surface">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        <textarea
                            ref={textareaRef}
                            aria-label="Message"
                            placeholder="Ask anything about the project..."
                            className="max-h-44 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm text-app-text outline-none placeholder:text-app-text-disabled"
                            value={newRequest}
                            rows={1}
                            onChange={(e) => {
                                setNewRequest(e.currentTarget.value);

                                e.currentTarget.style.height = "auto";
                                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    e.currentTarget.form?.requestSubmit();
                                }
                            }}
                        />

                        <button
                            type="submit"
                            aria-label="Send message"
                            disabled={isThinking || isStreaming || !newRequest.trim()}
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-brand text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Send size={18} />
                        </button>
                    </form>

                    <p className="mt-2 text-center text-[11px] text-app-text-disabled">
                        Enter zum Senden · Shift + Enter für eine neue Zeile
                    </p>
                </footer>
            </div>

            {/* Desktop chat history sidebar — RIGHT side, always rendered */}
            <aside
                aria-label="Chat history"
                className={[
                    "hidden shrink-0 flex-col border-l border-app-border bg-app-bg-soft transition-all duration-200 md:flex",
                    desktopSidebarOpen ? "w-64" : "w-0 overflow-hidden border-l-0",
                ].join(" ")}
            >
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h2 className="font-bold text-sm tracking-wide text-app-text-muted uppercase">Chats</h2>
                    <button
                        aria-label="Close sidebar"
                        onClick={() => setDesktopSidebarOpen(false)}
                        className="text-app-text-muted hover:text-app-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                    <ChatSidebar chats={chats} setSidebarOpen={() => {}} />
                </div>
            </aside>
        </div>
    );
}
