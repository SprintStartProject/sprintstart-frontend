import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, MessagesSquare } from "lucide-react";
import { Spinner } from "../../../components/ui/Spinner";
import { IconTile } from "../../../components/ui/IconTile";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { getSessions } from "../../../services/buddyService";
import { queryKeys } from "../../../services/queryKeys";
import { formatRelativeDate } from "../../buddy/format";

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
 * Reads the hire's conversations from their own list endpoint rather than off the session
 * the app root holds: that session's list is only as fresh as the last time a surface
 * opened the buddy, and a summary card should be able to say what is there without opening
 * anything. One small request, cached under `queryKeys.buddy.sessions`, so coming back to
 * the dashboard serves it from cache.
 */
export function RecentChatsWidget() {
  const { data, loading } = useQueryFetch(queryKeys.buddy.sessions(), getSessions);
  const recentChats = (data ?? []).slice(0, PREVIEW_COUNT);

  return (
    <div className="group @container relative flex h-full flex-col overflow-hidden rounded-2xl p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-app-brand/10 blur-2xl"
      />

      <div className="relative mb-5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <IconTile icon={MessagesSquare} size="sm" tone="accent" />
          <span className="truncate text-sm font-semibold text-app-text">Your conversations</span>
        </div>

        <Link
          to="/buddy"
          className="flex shrink-0 items-center gap-1 rounded-lg text-xs font-medium text-app-text-muted transition-colors hover:text-app-brand-text"
          // Named here because the words beside the arrow step aside on a narrow card.
          aria-label="Open your buddy"
        >
          {/* Same container-width rule as `WidgetShell`: in a quarter-row card the label beside
              the title ran the link to within a few pixels of the card's edge. */}
          <span className="hidden @min-[17rem]:inline">Open buddy</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {loading ? (
        <div className="relative flex flex-1 items-center justify-center">
          <Spinner size="lg" label="Loading" />
        </div>
      ) : recentChats.length === 0 ? (
        <div className="relative flex flex-1 flex-col items-start justify-center gap-2">
          <p className="text-sm text-app-text-muted">
            No conversations yet — ask your buddy below and it shows up here.
          </p>
        </div>
      ) : (
        <ul className="relative flex-1 space-y-1">
          {recentChats.map((conversation) => (
            <li key={conversation.id}>
              <Link
                to={`/buddy/${conversation.id}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-app-surface-hover"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />

                <span className="min-w-0 flex-1 truncate text-sm text-app-text">
                  {conversation.title || "Untitled conversation"}
                </span>

                <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
                  {formatRelativeDate(conversation.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
