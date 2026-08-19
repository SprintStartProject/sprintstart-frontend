import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { MessageSquareText, Plus, Search, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { centralSpringToken } from "../../../styles/tokens";
import type { Chat, ChatSidebarProps } from "../types";
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

  return BUCKET_ORDER.filter((label) => map.has(label)).map((label) => ({
    label,
    chats: map.get(label)!,
  }));
}

/**
 * ChatSidebar
 *
 * Displays the list of user chats grouped by date, with a search filter and a
 * relative timestamp on each item. Shows an empty state when no chats exist or
 * when the search query matches nothing. Triggers the provided `setSidebarOpen`
 * callback on mobile to close the drawer after selection.
 */
export function ChatSidebar({ chats, setSidebarOpen, onDeleteChat }: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const toast = useToast();

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return chats;
    return chats.filter((chat) => (chat.title ?? "").toLowerCase().includes(trimmed));
  }, [chats, query]);

  const groups = useMemo(() => groupChats(filtered), [filtered]);

  const handleConfirmDelete = async () => {
    if (!chatToDelete || !onDeleteChat || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteChat(chatToDelete.id);
      toast.success("Conversation deleted");
      setChatToDelete(null);
    } catch (err) {
      toast.error(parseApiError(err, "Couldn't delete conversation."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <NavLink
          to="/chat"
          state={{ newChat: true }}
          data-testid="chat-new"
          className="flex items-center justify-center gap-2 rounded-lg bg-app-brand p-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          onClick={() => setSidebarOpen(false)}
        >
          <Plus size={18} />
          New Chat
        </NavLink>

        {chats.length > 0 && (
          <Input
            size="sm"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
            placeholder="Search..."
            icon={<Search size={14} />}
          />
        )}

        {chats.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-app-surface-muted ring-1 ring-app-border">
              <MessageSquareText size={20} className="text-app-text-muted" />
            </div>
            <p className="text-xs leading-relaxed text-app-text-muted">
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
            <p className="text-xs leading-relaxed text-app-text-muted">
              No chats match &ldquo;{query.trim()}&rdquo;.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-2 py-1 text-xs font-bold tracking-wider text-app-text-muted uppercase">
                  {group.label}
                </p>

                <AnimatePresence mode="popLayout" initial={false}>
                  {group.chats.map((chat) => (
                    <motion.div
                      key={chat.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={centralSpringToken}
                    >
                      <NavLink
                        to={`/chat/${chat.id}`}
                        onClick={() => setSidebarOpen(false)}
                        aria-label={chat.title || "Untitled chat"}
                        className={({ isActive }) =>
                          `group flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm transition-all focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                            isActive
                              ? "bg-app-brand font-semibold text-white shadow-lg"
                              : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                          } `
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{chat.title || "Thinking..."}</span>
                          {onDeleteChat && (
                            <button
                              type="button"
                              aria-label={`Delete conversation "${chat.title || "Untitled"}"`}
                              data-testid={`chat-delete-button-${chat.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setChatToDelete(chat);
                              }}
                              className="rounded p-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-black/15 focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-app-focus focus-visible:outline-none dark:hover:bg-white/20"
                            >
                              <Trash2 size={13} className="shrink-0 opacity-80 hover:opacity-100" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] opacity-70">
                          {formatRelativeDate(chat.createdAt)}
                        </span>
                      </NavLink>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={chatToDelete !== null}
        onClose={() => {
          if (isDeleting) return;
          setChatToDelete(null);
        }}
        role="alertdialog"
        title="Delete conversation?"
        description={`This will permanently delete "${chatToDelete?.title || "this conversation"}" and all its messages. This cannot be undone.`}
        size="sm"
        testId="delete-chat-modal"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChatToDelete(null)}
              disabled={isDeleting}
              data-testid="cancel-delete-chat-btn"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleConfirmDelete()}
              loading={isDeleting}
              data-testid="confirm-delete-chat-btn"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      />
    </>
  );
}
