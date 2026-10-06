import { useState } from "react";
import { Trash2, X } from "lucide-react";
import type { BuddySessionSummary } from "../../../services/buddyService";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";

type BuddyConversationListProps = {
  /** Newest first, as the backend orders them. */
  sessions: BuddySessionSummary[];
  /** Which one is on screen — marked with `aria-current` and the brand tone. */
  currentSessionId: string | null;
  /**
   * True while a turn or an open is in flight: picking another conversation would clear the
   * thread out from under a reply still streaming into it (the session's guards back this up),
   * and binning is refused for the same reason — so its controls stand down with it.
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
 * **Binning is a confirmation, not a click.** The trash stands beside the row on hover or
 * focus (always, on touch), and the dialog spells out what happens before anything does — the
 * same deal the chat's sidebar struck, because it is the same kind of act. The row is removed
 * by the session, which is also what refuses mid-turn: a conversation cannot be binned out
 * from under a reply that is still streaming into it, so the controls stand down for that
 * window rather than failing after the fact.
 *
 * Search and date grouping still arrive with their own slice of the migration.
 */
export function BuddyConversationList({
  sessions,
  currentSessionId,
  disabled = false,
  onSelect,
  onBin,
  onClose,
  className,
}: BuddyConversationListProps) {
  const [sessionToBin, setSessionToBin] = useState<BuddySessionSummary | null>(null);
  const [isBinning, setIsBinning] = useState(false);
  const toast = useToast();

  const handleConfirmBin = async () => {
    if (!sessionToBin || !onBin || isBinning) return;
    setIsBinning(true);
    try {
      await onBin(sessionToBin.id);
      toast.success("Conversation binned");
      setSessionToBin(null);
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
            className="shrink-0 rounded p-1 text-app-text-muted transition-colors hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="m-0 min-h-0 list-none space-y-1 overflow-y-auto px-2 pb-3">
        {sessions.map((session) => {
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
                  "focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
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
                    "opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100",
                    "hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-1 focus-visible:ring-app-focus focus-visible:outline-none",
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

      {/* Binned, not deleted: the backend keeps the conversation until its retention window
          ends, and the dialog says so — "deleted for good after 7 days" is the backend's own
          cleanup rule, and the reason this wording differs from the chat's "cannot be undone". */}
      <Modal
        isOpen={sessionToBin !== null}
        onClose={() => {
          if (isBinning) return;
          setSessionToBin(null);
        }}
        role="alertdialog"
        title="Bin conversation?"
        description={`"${sessionToBin?.title.trim() || UNTITLED}" leaves your conversation list and is deleted for good after 7 days.`}
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
