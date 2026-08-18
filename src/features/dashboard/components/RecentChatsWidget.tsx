import { useContext } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, MessagesSquare } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { ChatContext } from "../../../context/ChatContext";
import { formatRelativeDate } from "../../chatbot/format";

const PREVIEW_COUNT = 4;

/**
 * The user's recent conversations, filling the dashboard slot the onboarding card leaves
 * empty.
 *
 * Whoever sees this has no onboarding to continue — an admin or PM who never had one, or
 * someone who finished theirs — so the slot offers the other thing worth picking up: the
 * questions they were already asking. Deliberately a counterpart to its neighbours rather
 * than a third way to start something: the knowledge base card is what the project knows,
 * the composer below starts a new question, and this is where the user left off.
 *
 * Reads {@link ChatContext} directly, like the composer widget does. The provider at the
 * app root already holds the list for the selected project, so the card costs no request,
 * follows the project switcher, and picks up a chat created seconds ago. Reading the
 * context rather than `useChat` also matters: that hook is bound to the chat route's `:id`
 * and would redirect the dashboard away to the most recent conversation.
 */
export function RecentChatsWidget() {
  const chat = useContext(ChatContext);

  // `chatsProjectId` is null until the list arrives — but also forever when no project is
  // selected, because the provider never fetches then. Without the second half of this the
  // card would spin for good on an account with no project.
  const isLoading =
    chat !== undefined && chat.chatsProjectId === null && chat.selectedProjectId !== "";
  const recentChats = (chat?.sortedChats ?? []).slice(0, PREVIEW_COUNT);

  return (
    <div className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm">
            <MessagesSquare className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold text-app-text">Your conversations</span>
        </div>

        <Link
          to="/chat"
          className="flex shrink-0 items-center gap-1 rounded-lg text-xs font-medium text-app-text-muted transition-colors hover:text-app-brand-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          Open chat
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="relative flex flex-1 items-center justify-center">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : recentChats.length === 0 ? (
        <div className="relative flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-sm text-app-text-muted">
            No conversations yet — ask the assistant below and it shows up here.
          </p>
        </div>
      ) : (
        <ul className="relative flex-1 space-y-1">
          {recentChats.map((recentChat) => (
            <li key={recentChat.id}>
              <Link
                to={`/chat/${recentChat.id}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-app-surface-hover"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />

                <span className="min-w-0 flex-1 truncate text-sm text-app-text">
                  {recentChat.title || "Untitled chat"}
                </span>

                <span className="shrink-0 text-[11px] text-app-text-muted tabular-nums">
                  {formatRelativeDate(recentChat.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
