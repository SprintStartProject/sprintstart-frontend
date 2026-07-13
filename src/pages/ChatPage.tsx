import {Bot, Check, Filter, MessageSquareText, Plus, Send, Sparkles, User, X} from "lucide-react";
import { useChat } from "../features/chatbot/hooks/useChat.ts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatSidebar } from "../features/chatbot/components/ChatSidebar.tsx";
import { PageHeader } from "../components/layout/PageHeader.tsx";

import "katex/dist/katex.min.css";
import {SOURCE_SYSTEMS} from "../features/chatbot/types.ts";

/**
 * Displays the interface for communication with the chat.
 */
export function ChatPage() {
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
        selectedCitation,
        setSelectedCitation,
        sidebarOpen,
        setSidebarOpen,
        textareaRef,
        bottomRef,
        showBrainrot,
        timestamp,
        showFilters,
        setShowFilters,
        from,
        setFrom,
        to,
        setTo,
        sourceSystems,
        toggleSourceSystem
    } = useChat();

    return (
        <div className="app-page-frame flex h-[calc(100vh-64px)] overflow-hidden bg-app-bg text-app-text lg:h-screen">
            {chats?.length !== 0 && (
                <aside className="w-64 bg-app-bg border-r border-app-border md:flex flex-col shrink-0 hidden">
                    <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
                </aside>
            )}

            <aside
                className={`
                    fixed top-0 left-0 h-full w-64 bg-app-bg
                    border-r border-app-border z-50
                    transform transition-transform duration-300
                    md:hidden
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                <div className="p-4 flex justify-between items-center">
                    <h2 className="font-bold">Chats</h2>

                    <button onClick={() => setSidebarOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <ChatSidebar chats={chats} setSidebarOpen={setSidebarOpen} />
            </aside>

            <button
                className="
                    fixed
                    top-4
                    right-[var(--app-page-gutter)]
                    z-50
                    md:hidden
                    p-3
                    text-white
                    rounded-full
                    bg-app-surface
                    border
                    border-app-border
                    shadow-lg
                    mt-15
                    hover:cursor-pointer
                "
                onClick={() => setSidebarOpen(!sidebarOpen)}
            >
                <MessageSquareText size={24} />
            </button>

            <div className="flex flex-col flex-1 min-w-0">
                <PageHeader
                    icon={Sparkles}
                    title="AI Assistant"
                    subtitle="Ask questions about project knowledge, code, documentation and onboarding."
                    className="shrink-0 border-b border-app-border bg-app-bg/80 px-6 py-4 backdrop-blur-md"
                />

                <div className="flex-1 overflow-y-auto flex flex-col">
                    {!chatId && (
                        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center">
                            <div className="bg-app-brand-soft p-4 rounded-3xl mb-4">
                                <Bot className="text-app-brand-text size-12" />
                            </div>

                            <h1 className="text-app-text font-bold text-2xl mb-2">
                                How can I help you today?
                            </h1>

                            <p className="text-app-text-muted max-w-md text-sm">
                                Ask anything about your project&apos;s codebase, documentation, or
                                onboarding process.
                            </p>
                        </div>
                    )}

                    <div className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
                        {messages.map((message, index) => {
                            const isRequest = message.role === "USER";

                            if (
                                message.role === "ASSISTANT" &&
                                message.content === "" &&
                                isThinking
                            ) {
                                return null;
                            }

                            return (
                                <div
                                    key={index}
                                    className={`flex w-full gap-4 ${
                                        isRequest ? "flex-row-reverse" : "flex-row"
                                    }`}
                                >
                                    <div
                                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                            isRequest ? "bg-app-brand" : "bg-app-surface-muted"
                                        }`}
                                    >
                                        {isRequest ? (
                                            <User size={16} className="text-white" />
                                        ) : (
                                            <Bot size={16} className="text-app-brand-text" />
                                        )}
                                    </div>

                                    <div
                                        className={`flex flex-col max-w-[85%] ${
                                            isRequest ? "items-end" : "items-start"
                                        }`}
                                    >
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                                isRequest
                                                    ? "bg-app-brand text-white rounded-tr-none"
                                                    : "bg-app-surface-muted border border-app-border-muted text-app-text rounded-tl-none"
                                            }`}
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm, remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
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
                                                    h1: ({ children }) => (
                                                        <h1 className={`text-2xl font-semibold my-4 pb-1 border-b ${isRequest ? "border-app-brand-border" : "border-app-border-muted"}`}>
                                                            {children}
                                                        </h1>
                                                    ),

                                                    h2: ({ children }) => (
                                                        <h2 className={`text-xl font-semibold my-3 pb-1 border-b ${isRequest ? "border-app-brand-border" : "border-app-border-muted"}`}>
                                                            {children}
                                                        </h2>
                                                    ),

                                                    h3: ({ children }) => (
                                                        <h3 className="text-lg font-semibold my-2">
                                                            {children}
                                                        </h3>
                                                    ),

                                                    h4: ({ children }) => (
                                                        <h4 className="text-md font-semibold my-1">
                                                            {children}
                                                        </h4>
                                                    ),
                                                    hr: () => (
                                                        <hr
                                                            className={`my-4 border-t border-3 ${isRequest ? "border-app-brand-border" : "border-app-border-muted"}`}
                                                        />
                                                    ),
                                                    ul: ({ children }) => (
                                                        <ul className="list-disc pl-6 my-3 space-y-1">
                                                            {children}
                                                        </ul>
                                                    ),

                                                    ol: ({ children }) => (
                                                        <ol className="list-decimal pl-6 my-3 space-y-1">
                                                            {children}
                                                        </ol>
                                                    ),

                                                    li: ({ children }) => (
                                                        <li>{children}</li>
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
                                                    },
                                                    a: ({ href, children }) => (
                                                        <a
                                                            href={href}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`
                                                                underline
                                                                underline-offset-2
                                                                transition-colors
                                                                ${
                                                                    isRequest
                                                                        ? "text-blue-200 hover:text-blue-100"
                                                                        : "text-app-brand hover:text-app-brand-hover"
                                                                }
                                                            `}
                                                        >
                                                            {children}
                                                        </a>
                                                    )
                                                }}>
                                                {message.content}
                                            </ReactMarkdown>

                                            {message.citations && message.citations.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-app-border-muted flex flex-wrap gap-1.5">
                                                    {message.citations.map((citation, cIdx) => (
                                                        <button
                                                            key={cIdx}
                                                            onClick={() =>
                                                                setSelectedCitation(citation)
                                                            }
                                                            className="text-[10px] bg-app-bg-soft hover:bg-app-surface text-app-brand-text px-2 py-0.5 rounded border border-app-brand-border transition-colors"
                                                        >
                                                            [{cIdx + 1}] {citation.filename}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isThinking &&  (
                            <div className="flex w-full gap-4">
                                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-app-surface-muted">
                                    <Bot size={16} className="text-app-brand-text" />
                                </div>

                                <div className="flex flex-col items-start max-w-[85%]">
                                    <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-app-surface-muted text-app-text">
                                        <div className="flex gap-1 items-center">
                                            <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce" />
                                            <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:150ms]" />
                                            <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:300ms]" />

                                            {thinkingState === "retrieve" && (
                                                <span className="italic pl-2 animate-pulse">Searching knowledge base...</span>
                                            )}

                                            {thinkingState === "synthesis" && (
                                                <span className="italic pl-2 animate-pulse">Synthesizing answer...</span>
                                            )}

                                            {thinkingState === "grep" && (
                                                <span className="italic pl-2 animate-pulse">Scanning documents...</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showBrainrot && (
                            <iframe
                                title="Subway Surfers Gameplay 2h"
                                src={`https://www.youtube.com/embed/vTfD20dbxho?start=${timestamp}&autoplay=1&mute=1`}
                                className="w-full h-100 rounded-xl"
                                allowFullScreen
                                allow="autoplay"
                            />
                        )}

                        <div ref={bottomRef} />
                    </div>
                </div>

                {selectedCitation && (
                    <div className="absolute right-6 bottom-24 w-80 rounded-xl bg-app-surface border border-app-border p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-bold text-app-text truncate pr-4">
                                {selectedCitation.filename}
                            </h3>

                            <button
                                onClick={() => setSelectedCitation(null)}
                                className="text-app-text-muted hover:text-app-text transition-colors"
                            >
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>

                        <div className="text-xs text-app-text line-clamp-4 leading-relaxed">
                            {selectedCitation.section_path}
                        </div>
                    </div>
                )}

                <footer className="p-4 bg-app-bg border-t border-app-border">
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
                        className="max-w-4xl mx-auto flex gap-3 items-end"
                    >
                        <button
                            type="button"
                            onClick={() => setShowFilters((v) => !v)}
                            className="p-2.5 rounded-xl border border-app-border bg-app-surface-muted hover:bg-app-surface transition-colors h-11 w-11 flex items-center justify-center"
                        >
                            <Filter size={20} />
                        </button>

                        <textarea
                            ref={textareaRef}
                            placeholder="Ask anything about the project..."
                            className="flex-1 px-4 py-2.5 rounded-xl text-app-text text-sm bg-app-surface-muted border border-app-border-muted placeholder:text-app-text-disabled outline-none focus:ring-2 focus:ring-app-focus/50 transition-all max-h-44 min-h-11 overflow-y-auto resize-none"
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
                            disabled={isThinking || isStreaming || !newRequest.trim()}
                            className="p-2.5 bg-app-brand text-white rounded-xl hover:bg-app-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-11 w-11 flex justify-center items-center"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
}
