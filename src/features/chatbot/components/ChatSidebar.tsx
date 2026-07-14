import { NavLink } from "react-router-dom";
import { Plus } from "lucide-react";
import type { ChatSidebarProps } from "../types";

/**
 * ChatSidebar
 *
 * Displays the list of user chats and provides navigation between them.
 * Triggers the provided `setSidebarOpen` callback on mobile to close the drawer after selection.
 */
export function ChatSidebar({ chats, setSidebarOpen }: ChatSidebarProps) {
    return (
        <div className="flex flex-col gap-4 p-4 overflow-y-auto">
            <NavLink
                to="/chat"
                className="bg-app-brand rounded-lg hover:bg-app-brand-hover flex justify-center gap-2 items-center text-sm font-semibold p-2.5 text-white transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                onClick={() => setSidebarOpen(false)}
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
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => `
                            group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus
                            ${
                                isActive
                                    ? "bg-app-brand text-white shadow-lg font-semibold"
                                    : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                            }
                        `}
                    >
                        <div className="truncate flex-1">
                            {chat.title || "Thinking..."}
                        </div>
                    </NavLink>
                ))}
            </div>
        </div>
    );
}
