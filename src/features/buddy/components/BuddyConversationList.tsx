import { useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Search, Trash2, X } from "lucide-react";
import type { BuddySessionSummary } from "../../../services/buddyService";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { dateBucketLabel } from "../format";

type BuddyConversationListProps = {
  /** Newest first, as the backend orders them. */
  sessions: BuddySessionSummary[];
  /** Which one is on screen — marked with `aria-current` and the brand tone. */
  currentSessionId: string | null;
  /**
   * True while an open, a greeting, or a decision is in flight — and in team mode, whose list is
   * there to look at but not to switch away with. The session refuses those moves; this is the
   * same state kept here so the list does not offer what the session will bounce. A running
   * answer does not disable it: picking or binning the conversation it streams into stops it
   * first (see `stopRunningTurn`).
   */
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  /**
   * Bins one conversation — the confirmed half of the trash control. The session removes the
   * row, moves the hire off a conversation they have just binned, and throws if the backend
   * refused.
   */
  onBin?: (sessionId: string) => Promise<void>;
  /**
   * Starts a new conversation — the button at the top of the list, where the conversations it
   * adds to are. Omitted, no button is drawn.
   */
  onNew?: () => void;
  /** Whether starting one is possible right now; the button stays on screen, greyed out. */
  newDisabled?: boolean;
  /** Named in the button's tooltip, so the chord is discoverable from the control it repeats. */
  newShortcut?: string;
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

/** The backend's own retention window for binned conversations (`BuddySessionCleanupService`). */
const BIN_RETENTION_DAYS = 7;

/** A short "when" for a row: the day the conversation was started, as a person reads it. */
function formatStartedOn(createdAt: string): string {
  const date = new Date(createdAt);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Ordered list of date-bucket labels — drives the grouping order in the rail (most recent
 * first). Sessions whose bucket is not in this list fall under "Older".
 */
const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Older"] as const;

type SessionGroup = {
  label: string;
  sessions: BuddySessionSummary[];
};

/**
 * Groups conversations by their calendar-day bucket so the rail stays scannable as history
 * grows. The list arrives most-recent first and keeps that order within each group.
 */
function groupSessions(sessions: BuddySessionSummary[]): SessionGroup[] {
  const map = new Map<string, BuddySessionSummary[]>();

  for (const session of sessions) {
    const label = dateBucketLabel(session.createdAt);
    const existing = map.get(label);
    if (existing) {
      existing.push(session);
    } else {
      map.set(label, [session]);
    }
  }

  return BUCKET_ORDER.filter((label) => map.has(label)).map((label) => ({
    label,
    sessions: map.get(label)!,
  }));
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
 * **Binning is a confirmation, not a click.** The trash stands beside the row on hover or
 * focus (always, on touch), and the dialog spells out what happens before anything does — the
 * same deal the chat's sidebar struck, because it is the same kind of act. The row is removed
 * by the session, which stops a reply still streaming into that conversation before the bin
 * goes through (see `stopRunningTurn`); binning another row leaves a running answer alone.
 *
 * Search filters by title and rows sit under date buckets — the shape the chat's sidebar had,
 * kept because a list that only grows is a wall by the tenth conversation. Both are client-side
 * over the list the page already holds: it is one hire's conversations, small by nature.
 */
export function BuddyConversationList({
  sessions,
  currentSessionId,
  disabled = false,
  onSelect,
  onBin,
  onNew,
  newDisabled = false,
  newShortcut,
  onClose,
  className,
}: BuddyConversationListProps) {
  const [sessionToBin, setSessionToBin] = useState<BuddySessionSummary | null>(null);
  const [isBinning, setIsBinning] = useState(false);
  const [query, setQuery] = useState("");
  const toast = useToast();

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sessions;
    return sessions.filter((session) => session.title.toLowerCase().includes(trimmed));
  }, [sessions, query]);

  const groups = useMemo(() => groupSessions(filtered), [filtered]);
  // Where focus lands after a successful bin: the dialog restores to the trash it was opened
  // from, but that row is gone by then — the first remaining conversation takes it instead.
  const listRef = useRef<HTMLUListElement>(null);

  const handleConfirmBin = async () => {
    if (!sessionToBin || !onBin || isBinning) return;
    setIsBinning(true);
    try {
      await onBin(sessionToBin.id);
      toast.success("Conversation binned");
      setSessionToBin(null);
      // The dialog hands focus back to the trash button it was opened from — but that row is
      // gone now. Land the keyboard on the first conversation still in the list (the one that
      // took over when the binned conversation was on screen).
      window.requestAnimationFrame(() => {
        listRef.current?.querySelector<HTMLElement>("li button")?.focus();
      });
    } catch (err) {
      toast.error(parseApiError(err, "Couldn't bin that conversation."));
    } finally {
      setIsBinning(false);
    }
  };

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
            className="shrink-0 rounded p-1 text-app-text-muted transition-colors hover:text-app-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {onNew && (
        <div className="shrink-0 px-4 pb-2">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={onNew}
            disabled={newDisabled}
            // Named like the floating button it stands in for. The visible text alone would
            // collide with an untitled row, which is also called "New conversation".
            aria-label="Start a new conversation"
            icon={<MessageSquarePlus className="h-4 w-4" aria-hidden="true" />}
            title={
              newShortcut
                ? `Start a new conversation (${newShortcut}) \u2014 your buddy keeps what it has learned about you`
                : "Start a new conversation \u2014 your buddy keeps what it has learned about you"
            }
          >
            New conversation
          </Button>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="shrink-0 px-4 pb-2">
          <Input
            size="sm"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search conversations"
            placeholder="Search..."
            icon={<Search size={14} />}
          />
        </div>
      )}

      <ul ref={listRef} className="m-0 min-h-0 list-none overflow-y-auto px-2 pb-3">
        {filtered.length === 0 && query.trim() !== "" && (
          <li className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-xs leading-relaxed text-app-text-muted">
              No conversations match &ldquo;{query.trim()}&rdquo;.
            </p>
          </li>
        )}

        {groups.map((group) => (
          <li key={group.label}>
            <p className="px-2 pt-3 pb-1 text-xs font-bold tracking-wider text-app-text-muted uppercase">
              {group.label}
            </p>

            <ul className="m-0 list-none space-y-1 p-0">
              {group.sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;
                const title = session.title.trim() || UNTITLED;

                return (
                  <li key={session.id} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      disabled={disabled}
                      aria-current={isCurrent ? "true" : undefined}
                      className={[
                        "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg py-2 pl-2.5 text-left text-sm transition-colors",
                        // Room for the trash, which floats over the row's right edge.
                        onBin ? "pr-9" : "pr-2.5",
                        isCurrent
                          ? "bg-app-brand-soft font-medium text-app-brand-text"
                          : "text-app-text hover:bg-app-surface-hover",
                        disabled ? "cursor-not-allowed opacity-60" : "",
                      ].join(" ")}
                    >
                      <span className="truncate">{title}</span>
                      <span className="shrink-0 text-xs text-app-text-subtle" aria-hidden="true">
                        {formatStartedOn(session.createdAt)}
                      </span>
                    </button>

                    {onBin && (
                      <button
                        type="button"
                        aria-label={`Bin conversation "${title}"`}
                        data-testid={`buddy-bin-button-${session.id}`}
                        onClick={() => setSessionToBin(session)}
                        disabled={disabled}
                        className={[
                          "absolute right-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-app-text-muted",
                          "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100",
                          // No focus ring of its own: the app-wide outline (styles/index.css) covers
                          // every keyboard-focusable control, and a per-element ring would replace it.
                          "hover:bg-app-surface-hover hover:text-app-text",
                          disabled ? "cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {/* Binned, not deleted: the backend keeps the conversation until its retention window
          ends, and the dialog says so — the window below is the backend's own cleanup rule
          (`BuddySessionCleanupService`), and the reason this wording differs from the chat's
          "cannot be undone". */}
      <Modal
        isOpen={sessionToBin !== null}
        onClose={() => {
          if (isBinning) return;
          setSessionToBin(null);
        }}
        role="alertdialog"
        title="Bin conversation?"
        description={`"${sessionToBin?.title.trim() || UNTITLED}" leaves your conversation list and is deleted for good after ${BIN_RETENTION_DAYS} days.`}
        size="sm"
        testId="bin-conversation-modal"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSessionToBin(null)}
              disabled={isBinning}
              data-testid="cancel-bin-conversation-btn"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleConfirmBin()}
              disabled={disabled}
              loading={isBinning}
              data-testid="confirm-bin-conversation-btn"
            >
              {isBinning ? "Binning..." : "Bin"}
            </Button>
          </>
        }
      />
    </div>
  );
}
