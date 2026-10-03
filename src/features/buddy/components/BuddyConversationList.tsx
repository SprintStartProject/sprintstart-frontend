import { X } from "lucide-react";
import type { BuddySessionSummary } from "../../../services/buddyService";

type BuddyConversationListProps = {
  /** Newest first, as the backend orders them. */
  sessions: BuddySessionSummary[];
  /** Which one is on screen — marked with `aria-current` and the brand tone. */
  currentSessionId: string | null;
  /**
   * True while a turn or an open is in flight: picking another conversation would clear the
   * thread out from under a reply still streaming into it (the session's guards back this up).
   */
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  /**
   * Closes the rail from its header. This list is the rail's top row, so the cross for the whole
   * panel lives here — one rail, one way out, the same shape as the chat's "Chats" rail. (The
   * PM replies panel used to carry one mid-rail; it read as closing that section alone, and a
   * conversations-only rail had none at all.) Same words as the backdrop (`dismissLabel`),
   * because it is the same act.
   */
  onClose?: () => void;
  /** From the rail: the list scrolls within whatever room the rail gives it. */
  className?: string;
};

/** What a conversation is called before its first message has written it a title. */
const UNTITLED = "New conversation";

/** A short "when" for a row: the day the conversation was started, as a person reads it. */
function formatStartedOn(createdAt: string): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The hire's conversations, as a switchable list — the rail's primary content.
 *
 * One row per conversation, newest first (the order the backend sends them in, which is also
 * the order a picker is read). The row that is on screen is marked rather than removed: a list
 * whose current entry vanished would read as "not in any conversation". Picking that row is a
 * no-op in the session rather than a disabled control here, so it stays focusable and is
 * announced as the current one.
 *
 * Deliberately plain for now — search, date grouping and binning arrive with the rail's own
 * slice of the migration.
 */
export function BuddyConversationList({
  sessions,
  currentSessionId,
  disabled = false,
  onSelect,
  onClose,
  className,
}: BuddyConversationListProps) {
  return (
    <div className={["flex min-h-0 flex-col", className ?? ""].join(" ")}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="truncate text-xs font-semibold tracking-wide text-app-text-muted uppercase">
          Conversations
        </h2>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close your conversations"
            className="shrink-0 rounded p-1 text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="m-0 min-h-0 list-none space-y-1 overflow-y-auto px-2 pb-3">
        {sessions.map((session) => {
          const isCurrent = session.id === currentSessionId;

          return (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                disabled={disabled}
                aria-current={isCurrent ? "true" : undefined}
                className={[
                  "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  isCurrent
                    ? "bg-app-brand-soft font-medium text-app-brand-text"
                    : "text-app-text hover:bg-app-surface-hover",
                  "focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
                  disabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <span className="truncate">{session.title.trim() || UNTITLED}</span>
                <span className="shrink-0 text-xs text-app-text-subtle" aria-hidden="true">
                  {formatStartedOn(session.createdAt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
