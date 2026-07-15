import { Bot, Check, ExternalLink, Filter, MessageSquareText, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useChat } from "../features/chatbot/hooks/useChat.ts";
import { useAuth } from "../context/useAuth";
import { UserAvatar } from "../components/common/UserAvatar.tsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatSidebar } from "../features/chatbot/components/ChatSidebar.tsx";
import { MessageCitations } from "../features/chatbot/components/MessageCitations.tsx";
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
        newRequest,
        setNewRequest,
        sidebarOpen,
        setSidebarOpen,
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
        scrollContainerRef
    } = useChat();
    const hasChatHistory = chats?.length !== 0;

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
        <div
            className={[
                "flex h-[calc(100vh-64px)] overflow-hidden bg-app-bg text-app-text lg:h-screen",
                hasChatHistory ? "" : "app-page-frame",
            ].filter(Boolean).join(" ")}
        >
            {hasChatHistory && (
                <aside className="hidden w-64 shrink-0 flex-col border-r border-app-border bg-app-bg-soft md:flex">
                    <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
                </aside>
            )}

            <aside
                id="chat-mobile-sidebar"
                aria-label="Mobile chat navigation"
                aria-hidden={!sidebarOpen}
                inert={!sidebarOpen}
                className={`
                    fixed top-0 left-0 z-50 h-full w-64 bg-app-bg-soft
                    border-r border-app-border shadow-2xl
                    transform transition-transform duration-300
                    md:hidden
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                <div className="flex items-center justify-between p-4">
                    <h2 className="font-bold">Chats</h2>

                    <button aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
            </aside>

            <button
                aria-label="Toggle sidebar"
                aria-controls="chat-mobile-sidebar"
                aria-expanded={sidebarOpen}
                className="
                    fixed top-4 right-[var(--app-page-gutter)] z-50 mt-15
                    rounded-full border border-app-border bg-app-surface
                    p-3 text-app-text shadow-lg
                    hover:cursor-pointer hover:bg-app-surface-hover
                    md:hidden
                "
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <MessageSquareText size={24} />
            </button>

            <div className="flex min-w-0 flex-1 flex-col">
                <PageHeader
                    icon={Sparkles}
                    title="AI Assistant"
                    subtitle="Ask questions about project knowledge, code, documentation and onboarding."
                    className="shrink-0 border-b border-app-border bg-app-bg/80 px-6 py-4 backdrop-blur-md"
                />

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

                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
                        {messages.map((message, index) => {
                            const isRequest = message.role === "USER";

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

                            return (
                                <div
                                    key={index}
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
                                        className={`flex max-w-[85%] flex-col ${
                                            isRequest ? "items-end" : "items-start"
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

                                            {!isRequest && citations.length > 0 && (
                                                <MessageCitations citations={citations} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {gameActive && isThinking ? (
                            <div className="flex w-full gap-3">
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
                                <div className="flex w-full gap-3">
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

                <footer className="shrink-0 border-t border-app-border bg-app-bg px-4 py-4">
                    {showFilters && (
                        <div className="max-w-4xl mx-auto w-full px-4 mb-3">
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
                                    <span className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold">
                                        Systems
                                    </span>

                                    <div className="flex flex-wrap gap-2 min-h-10 items-center">
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
                        className="mx-auto flex max-w-5xl items-end gap-2 rounded-2xl border border-app-border-muted bg-app-surface-muted p-2 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
                    >
                        <button
                            type="button"
                            aria-label="Toggle source filters"
                            aria-expanded={showFilters}
                            onClick={() => setShowFilters((v) => !v)}
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-surface border border-app-border-muted text-app-text-muted hover:bg-app-surface-hover hover:text-app-text transition-colors"
                        >
                            <Filter size={18} />
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

                    <p className="mx-auto mt-2 max-w-5xl px-1 text-center text-[11px] text-app-text-disabled">
                        Enter zum Senden · Shift + Enter für eine neue Zeile
                    </p>
                </footer>
            </div>
        </div>
    );
}
