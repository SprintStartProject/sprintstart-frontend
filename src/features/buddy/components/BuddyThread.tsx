import { Fragment, memo } from "react";
import type { ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toolLabel } from "../toolLabel";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";
import { BuddyMessage, BuddyTypingMessage } from "./BuddyMessage";

type BuddyThreadProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /**
   * True while the reply is still receiving tokens. Together with `isThinking`
   * this is what keeps the waiting game's "reply ready" badge honest: the game
   * only claims the reply is there once the turn has actually finished.
   */
  isStreaming?: boolean;
  /** The tool the buddy is running right now, if any — becomes "Checking your progress…". */
  activeTool: string | null;
  /** Confirms a buddy-proposed action (the only path that mutates). */
  confirmAction: (messageId: string, action: ProposedAction) => void;
  /** Declines a proposed action; nothing changes. */
  dismissAction: (messageId: string, actionId: string) => void;
  /** Names above the bubbles — on for the page, off in the dock. */
  showNames?: boolean;
  /** The dock's narrow layout — see `BuddyMessage`'s `compact`. */
  compact?: boolean;
  /** Rendered above the first message: what came back from the hire's PM. */
  before?: ReactNode;
  /**
   * Rendered under the buddy's most recent reply — the greeting's suggested next step.
   */
  lastMessageFooter?: ReactNode;
  /**
   * Rendered under each of the hire's *own* questions, handed that question's text.
   *
   * This is where escalating belongs. It hung off the buddy's answer before, which read as a
   * verdict on the reply — but a hire does not flag an answer, they flag the question they
   * still need answered, and they may well want to send one they asked ten minutes ago. Under
   * every question, they can. Both surfaces pass it, so the corner window can escalate too.
   *
   * Must be referentially stable, like `renderReplyAction`: the rows below are memoised, and a
   * fresh function per render of the caller would re-render every turn with it.
   */
  renderQuestionAction?: (question: string) => ReactNode;
  /**
   * Rendered under each of the buddy's *replies*, handed that reply's Markdown.
   *
   * Where keeping something from the conversation belongs. The thread does not know what is worth
   * keeping or how — it hands over the text and lets the caller decide, which is what stops this
   * component from growing a dependency on the board.
   *
   * Must be referentially stable: a fresh function per render of the caller would hand every
   * memoised row a new prop and re-parse every reply's markdown with it.
   */
  renderReplyAction?: (reply: string, message: BuddyMessageView) => ReactNode;
  /**
   * Why the conversation could not be brought on screen at all, if it could not.
   *
   * Distinct from a turn that failed, which carries its own reason: this one has no turn to hang
   * on, and it is the difference between "the buddy could not answer" and "there is no buddy
   * here". Passed by both surfaces, because the read is made once for both of them.
   */
  openError?: string | null;
  /** Tries the read again. The banner is only worth showing when there is something to press. */
  onRetryOpen?: () => void;
  /**
   * Whether the dino waiting-game is open while the buddy thinks (unlocked
   * users only; Space opens it — see useSpaceOpensDino). Both surfaces pass
   * it so dock and page offer the same deal.
   */
  dinoGameActive?: boolean;
  /** Called when the player leaves the dino waiting-game. */
  onDinoGameExit?: () => void;
  /**
   * Clears the conversation above the visit divider and opens a clean one.
   *
   * Offered from the divider itself rather than from a button in the page header, because the
   * divider is the one place on screen that already means "everything above here is the last
   * conversation" — a control that tidies exactly that belongs on the line that says so, and
   * nowhere else. Which is also why it is only ever drawn when there *is* a divider: a visit
   * with nothing above it is already the fresh one.
   */
  onStartFreshVisit?: () => void;
  /**
   * The keyboard chord for that control, named in its tooltip — when there is one.
   *
   * Passed in rather than read from `useNewConversationShortcut`, because whether the chord
   * does anything depends on who is rendering this thread. `/buddy` binds it and says so; the
   * dock floats over pages that bind it to their *own* new conversation, or to nothing at all,
   * and a tooltip promising a key that starts somebody else's chat is worse than no tooltip.
   */
  freshVisitShortcut?: string;
};

type BuddyThreadRowProps = {
  message: BuddyMessageView;
  /** Whether this row is the turn currently receiving tokens. */
  isStreaming: boolean;
  showNames: boolean;
  compact: boolean;
  confirmAction: (messageId: string, action: ProposedAction) => void;
  dismissAction: (messageId: string, actionId: string) => void;
  renderQuestionAction?: (question: string) => ReactNode;
  renderReplyAction?: (reply: string, message: BuddyMessageView) => ReactNode;
  /** The greeting's suggested next step — present on the row it hangs under, nowhere else. */
  lastMessageFooter?: ReactNode;
  onStartFreshVisit?: () => void;
  freshVisitShortcut?: string;
};

/**
 * One turn: the visit divider if it opens one, then the bubble.
 *
 * Extracted from the thread's map and memoised for the same reason `MessageRow` in the chat is:
 * with the thread memoised, a keystroke never reaches it — and when a token arrives, only the row
 * it belongs to re-renders, while every other row's props stay referentially equal and it bails
 * out instead of re-running `ReactMarkdown` over its reply. In a fifty-message thread that is the
 * difference between one markdown parse and fifty per keystroke (issue #236).
 *
 * Which makes referential stability a *contract* on the props: the render callbacks must come
 * from `useCallback` in the caller, and `lastMessageFooter` from one `useMemo`.
 *
 * `lastMessageFooter` is resolved by the thread rather than here — "is this the last reply, and
 * has the buddy stopped writing" is a question about the whole list, and answering it in the row
 * would make each row depend on its neighbours.
 */
function BuddyThreadRowImpl({
  message,
  isStreaming,
  showNames,
  compact,
  confirmAction,
  dismissAction,
  renderQuestionAction,
  renderReplyAction,
  lastMessageFooter,
  onStartFreshVisit,
  freshVisitShortcut,
}: BuddyThreadRowProps) {
  const isUser = message.role === "USER";
  const hasText = message.content.trim().length > 0;
  const hasActions = (message.actions?.length ?? 0) > 0;

  // Until the first token (or an action proposal) arrives the streaming placeholder has
  // nothing to show, and the typing bubble below already stands in for it — so skip it,
  // otherwise an empty second bubble appears while the buddy is working. A turn that
  // failed before writing a word is the exception: its reason *is* the message, and
  // dropping it here is what made a failed reply look like no reply.
  if (!isUser && !hasText && !hasActions && !message.error) return null;

  return (
    <Fragment>
      {/* Everything above belongs to the last conversation; the buddy has just opened a
                        new one under it, grounded in what it remembers rather than in the text
                        above. Saying so is what stops the greeting reading as a non-sequitur
                        replying to a question from an hour ago. */}
      {message.startsVisit && (
        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-app-border" aria-hidden="true" />

          <span className="flex items-center gap-1">
            <span className="text-xs font-medium text-app-text-muted">New conversation</span>

            {onStartFreshVisit && (
              <button
                type="button"
                onClick={onStartFreshVisit}
                data-testid="buddy-clear-previous"
                aria-label="Clear the earlier conversation"
                title={
                  freshVisitShortcut
                    ? `Clear the earlier conversation (${freshVisitShortcut})`
                    : "Clear the earlier conversation"
                }
                className="rounded-full p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>

          <span className="h-px flex-1 bg-app-border" aria-hidden="true" />
        </div>
      )}

      <BuddyMessage
        speaker={isUser ? "YOU" : "BUDDY"}
        showName={showNames}
        compact={compact}
        isStreaming={isStreaming}
        error={message.error}
        footer={
          <>
            {isUser && renderQuestionAction?.(message.content)}
            {!isUser && hasText && renderReplyAction?.(message.content, message)}
            {!isUser && hasActions && (
              <BuddyActionProposals
                messageId={message.id}
                actions={message.actions ?? []}
                onConfirm={confirmAction}
                onDismiss={dismissAction}
              />
            )}
            {lastMessageFooter}
          </>
        }
      >
        {hasText ? (
          isUser ? (
            message.content
          ) : (
            <BuddyMarkdown content={message.content} />
          )
        ) : undefined}
      </BuddyMessage>
    </Fragment>
  );
}

const BuddyThreadRow = memo(BuddyThreadRowImpl);

/**
 * The conversation itself: every message, in order, with whoever is talking beside it.
 *
 * Shared by the dock and the page so there is one buddy with one voice, not two components
 * that drift. The only differences are the ones the width forces: names above the bubbles on
 * the page, none in the dock.
 *
 * It scrolls down, never sideways. `min-w-0` runs unbroken from here to `BuddyMarkdown`,
 * because a flex item's default `min-width: auto` refuses to shrink below its content — without
 * it a wide code block widens the bubble, the column and the panel, and the per-block scrollers
 * never engage.
 *
 * Both this and every row in it are memoised: re-rendering a long thread is what used to make
 * each keystroke re-run `ReactMarkdown` over every reply and every bubble's animation hooks
 * (issue #236). A keystroke no longer reaches this component at all, and a token reaches one row
 * — see `BuddyThreadRow` for the contract that keeps that true.
 */
function BuddyThreadImpl({
  messages,
  isThinking,
  isStreaming = false,
  activeTool,
  confirmAction,
  dismissAction,
  showNames = false,
  compact = false,
  before,
  lastMessageFooter,
  renderQuestionAction,
  renderReplyAction,
  openError,
  onRetryOpen,
  dinoGameActive = false,
  onDinoGameExit,
  onStartFreshVisit,
  freshVisitShortcut,
}: BuddyThreadProps) {
  // The send loop appends an empty assistant message up front and streams into it, so the last
  // one is the turn receiving tokens — while a turn is running at all. Being last is not on its
  // own "live": holding the newest row awake forever is a bot that never sleeps, so the row is
  // only flagged while tokens are actually arriving. The chat draws the same line in its
  // `MessageRow` (`streamingMessageId` is null when idle) — see `SleepyBot`'s `canSleep`.
  const streamingId = messages[messages.length - 1]?.id;

  // Which turn the footer hangs under: the buddy's most recent reply. Not every reply — the same
  // suggestion repeated under all of them reads as the buddy repeating itself. (This started as
  // the escalation offer, which now lives under the hire's own questions — see
  // `renderQuestionAction` on the props above.)
  //
  // A reply carrying only a proposal counts as a reply: the *empty* message the send loop appends
  // up front is the one to skip, and skipping it means "nothing written yet, and nothing offered".
  const lastAssistantId = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "ASSISTANT" &&
        (message.content.trim().length > 0 || (message.actions?.length ?? 0) > 0),
    )?.id;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {before}

      {/* Above the thread rather than in it: what failed is the whole conversation, so there is
                nothing below for it to belong to -- and on a first visit there is nothing below at
                all. `alert`, because it arrives without the hire doing anything. */}
      {openError && (
        <div
          role="alert"
          className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{openError}</span>
          {onRetryOpen && (
            <Button variant="secondary" size="sm" onClick={onRetryOpen}>
              Try again
            </Button>
          )}
        </div>
      )}

      {messages.map((message) => (
        <BuddyThreadRow
          key={message.id}
          message={message}
          isStreaming={
            // `Boolean`, not the bare comparison: `streamingId` is the latest message even after
            // a turn has finished, and this flag means "receiving tokens right now".
            Boolean(isStreaming && message.id === streamingId)
          }
          showNames={showNames}
          compact={compact}
          confirmAction={confirmAction}
          dismissAction={dismissAction}
          renderQuestionAction={renderQuestionAction}
          renderReplyAction={renderReplyAction}
          // Resolved here rather than inside the row: only the buddy's latest reply gets it, and
          // only once the thinking bubble is gone — so the offer lands under a finished answer
          // rather than under a promise.
          lastMessageFooter={
            !isThinking && message.id === lastAssistantId ? lastMessageFooter : undefined
          }
          onStartFreshVisit={onStartFreshVisit}
          freshVisitShortcut={freshVisitShortcut}
        />
      ))}

      {(isThinking || dinoGameActive) && (
        <BuddyTypingMessage
          label={activeTool ? toolLabel(activeTool) : undefined}
          showName={showNames}
          gameActive={dinoGameActive}
          replyReady={dinoGameActive && !isThinking && !isStreaming}
          // A failed reply carries its error on the last turn; announcing it as
          // "Reply ready" would be a lie. The buddy has no Stop, so only two outcomes.
          turnOutcome={messages[messages.length - 1]?.error ? "failed" : "done"}
          onGameExit={onDinoGameExit}
        />
      )}
    </div>
  );
}

export const BuddyThread = memo(BuddyThreadImpl);
