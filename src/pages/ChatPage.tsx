import {Bot, Plus, Send, Sparkles, User} from "lucide-react";
import { useChat } from "../hooks/useChat.ts"
import {NavLink} from "react-router-dom";
import ReactMarkdown from "react-markdown"

export function ChatPage() {

    const {messages, chatId, chats, handleSubmit, isThinking, newRequest, setNewRequest, selectedCitation, setSelectedCitation} = useChat();

    return (
        <div className="h-screen flex overflow-hidden bg-app-bg">

            { chats.length !== 0 && (
                <aside className="w-64 bg-app-surface border-r border-app-border flex flex-col shrink-0">
                    <div className="flex flex-col gap-4 p-4 overflow-y-auto">

                        <NavLink
                            to="/chat"
                            className="bg-app-brand rounded-lg hover:bg-app-brand-hover flex justify-center gap-2 items-center text-sm font-semibold p-2.5 text-white transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                        >
                            <Plus size={18} />
                            New Chat
                        </NavLink>

                        <div className="flex flex-col gap-1">
                            <p className="text-app-text-muted px-2 py-1 text-xs font-bold uppercase tracking-wider">
                                Recent Chats
                            </p>

                            {chats.map((chat) => (
                                <NavLink
                                    key={chat.id}
                                    to={`/chat/${chat.id}`}
                                    className={({ isActive }) => `
                                        group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus
                                        ${isActive ? "bg-app-surface-hover text-app-text font-semibold" : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"}
                                    `}
                                >
                                    {chat.title ?
                                        <div className="truncate flex-1">
                                            {chat.title}
                                        </div> :
                                        <div className="truncate flex-1 italic">
                                            waiting for title...
                                        </div>
                                    }

                                </NavLink>
                            ))}
                        </div>
                    </div>
                </aside>
            )}

            <div className="flex flex-col flex-1 min-w-0">
                <header className="h-16 border-b border-app-border flex items-center px-6 shrink-0 bg-app-bg/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <Sparkles className="text-app-brand" size={20} />
                        <h1 className="font-bold text-app-text text-lg">AI Assistant</h1>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto flex flex-col">
                    
                    {!chatId &&
                        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center">
                            <div className="bg-app-brand-soft p-4 rounded-3xl mb-4">
                                <Bot className="text-app-brand size-12" />
                            </div>
                            <h1 className="text-app-text font-bold text-2xl mb-2">How can I help you today?</h1>
                            <p className="text-app-text-muted max-w-md text-sm">
                                Ask anything about your project&apos;s codebase, documentation, or onboarding process.
                            </p>
                        </div>}

                    <div className="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
                        {messages.map((message, index) => {
                            const isRequest = message.role === "USER";

                            return (
                                <div
                                    key={index}
                                    className={`flex w-full gap-4 ${isRequest ? "flex-row-reverse" : "flex-row"}`}
                                >
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isRequest ? "bg-app-brand shadow-sm" : "bg-app-surface border border-app-border"}`}>
                                        {isRequest ? <User size={16} className="text-white" /> : <Bot size={16} className="text-app-brand" />}
                                    </div>

                                    <div className={`flex flex-col max-w-[85%] ${isRequest ? "items-end" : "items-start"}`}>
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                                                ${isRequest ? "bg-app-brand text-white rounded-tr-none shadow-sm" : "bg-app-surface-muted text-app-text border border-app-border rounded-tl-none"}
                                            `}
                                        >
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>

                                            {message.citations && message.citations.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-app-border-muted flex flex-wrap gap-1.5">
                                                    {message.citations.map((citation, cIdx) => (
                                                        <button
                                                            key={cIdx}
                                                            onClick={() => setSelectedCitation(citation)}
                                                            className="text-[10px] bg-app-bg hover:bg-app-surface-hover text-app-brand-text px-2 py-0.5 rounded border border-app-brand-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-focus"
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
                    </div>
                </div>

                {selectedCitation && (
                    <div className="absolute right-6 bottom-24 w-80 rounded-xl bg-app-surface border border-app-brand-border-strong p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-bold text-app-text truncate pr-4">{selectedCitation.filename}</h3>
                            <button onClick={() => setSelectedCitation(null)} className="text-app-text-muted hover:text-app-text transition-colors">
                                <Plus size={18} className="rotate-45" />
                            </button>
                        </div>
                        <div className="text-xs text-app-text-muted line-clamp-4 leading-relaxed">
                            {selectedCitation.section_path}
                        </div>
                    </div>
                )}

                <footer className="p-4 bg-app-bg border-t border-app-border">
                    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
                        <input
                            type="text"
                            placeholder="Ask anything about the project..."
                            className="flex-1 px-4 py-2.5 rounded-full text-app-text text-sm bg-app-surface border border-app-border placeholder:text-app-text-disabled outline-none focus:ring-2 focus:ring-app-focus transition-all"
                            value={newRequest}
                            onChange={e => setNewRequest(e.currentTarget.value)}
                        />

                        <button
                            type="submit"
                            disabled={isThinking || !newRequest.trim()}
                            className="p-3 bg-app-brand text-white rounded-full hover:bg-app-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus shadow-md"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
}