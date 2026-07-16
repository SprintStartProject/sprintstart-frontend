import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { MessageSquareText, Plus, Search } from "lucide-react";
import type { ChatSidebarProps } from "../types";
import { dateBucketLabel, formatRelativeDate } from "../format";

/**
 * Ordered list of date-bucket labels — drives the grouping order in the sidebar
 * (most recent first). Chats whose bucket isn't in this list fall under "Older".
 */
const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Older"] as const;

type ChatGroup = {
    label: string;
    chats: ChatSidebarProps["chats"];
};

/**
 * Groups chats by their calendar-day bucket so the sidebar stays scannable as
 * history grows. Chats are already sorted most-recent first by the hook, so
 * we preserve that order within each group.
 */
function groupChats(chats: ChatSidebarProps["chats"]): ChatGroup[] {
    const map = new Map<string, ChatSidebarProps["chats"]>();

    for (const chat of chats) {
        const label = dateBucketLabel(chat.createdAt);
        const existing = map.get(label);
        if (existing) {
            existing.push(chat);
        } else {
            map.set(label, [chat]);
        }
    }

    return BUCKET_ORDER
        .filter((label) => map.has(label))
        .map((label) => ({ label, chats: map.get(label)! }));
}

/**
 * ChatSidebar
 *
 * Displays the list of user chats grouped by date, with a search filter and a
 * relative timestamp on each item. Shows an empty state when no chats exist or
 * when the search query matches nothing. Triggers the provided `setSidebarOpen`
 * callback on mobile to close the drawer after selection.
 */
export function ChatSidebar({ chats, setSidebarOpen }: ChatSidebarProps) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) return chats;
        return chats.filter((chat) =>
            (chat.title ?? "").toLowerCase().includes(trimmed),
        );
    }, [chats, query]);

    const groups = useMemo(() => groupChats(filtered), [filtered]);

    return (
        <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
            <NavLink
                to="/chat"
                state={{ newChat: true }}
                className="bg-app-brand rounded-lg hover:bg-app-brand-hover flex justify-center gap-2 items-center text-sm font-semibold p-2.5 text-white transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                onClick={() => setSidebarOpen(false)}
            >
                <Plus size={18} />
                New Chat
            </NavLink>

            {chats.length > 0 && (
                <div className="relative">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-subtle pointer-events-none"
                    />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search conversations"
                        placeholder="Search..."
                        className="w-full rounded-lg border border-app-border bg-app-bg pl-8 pr-3 py-2 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus-visible:ring-2 focus-visible:ring-app-focus/50"
                    />
                </div>
            )}

            {chats.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-app-surface-muted ring-1 ring-app-border">
                        <MessageSquareText size={20} className="text-app-text-muted" />
                    </div>
                    <p className="text-xs text-app-text-muted leading-relaxed">
                        No conversations yet.
                        <br />
                        Start one above!
                    </p>
                </div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-app-surface-muted ring-1 ring-app-border">
                        <Search size={20} className="text-app-text-muted" />
                    </div>
                    <p className="text-xs text-app-text-muted leading-relaxed">
                        No chats match &ldquo;{query.trim()}&rdquo;.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {groups.map((group) => (
                        <div key={group.label} className="flex flex-col gap-1">
                            <p className="text-app-text-muted px-2 py-1 text-xs font-bold uppercase tracking-wider">
                                {group.label}
                            </p>

                            {group.chats.map((chat) => (
                                <NavLink
                                    key={chat.id}
                                    to={`/chat/${chat.id}`}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) => `
                                        group flex flex-col gap-0.5 px-3 py-2 rounded-lg text-sm transition-all
                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus
                                        ${
                                            isActive
                                                ? "bg-app-brand text-white shadow-lg font-semibold"
                                                : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                                        }
                                    `}
                                >
                                    <span className="truncate">
                                        {chat.title || "Thinking..."}
                                    </span>
                                    <span className="text-[10px] opacity-70">
                                        {formatRelativeDate(chat.createdAt)}
                                    </span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
