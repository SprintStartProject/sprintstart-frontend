import type { ReactNode } from "react";
import type { BuddyMessageView, ProposedAction } from "../types";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyThread } from "./BuddyThread";
import { SaveReplyToBoard } from "./SaveReplyToBoard";
import { BookmarkPlus, MessagesSquare } from "lucide-react";
import { SaveToBoard } from "../../board/save/SaveToBoard";
import { buddyReplyNote, transcriptNote } from "../../board/generation/chatToCard";
import { useStickToBottom } from "../hooks/useStickToBottom";

type BuddyConversationProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /** The tool the buddy is running right now, if any — becomes "Checking your progress…". */
  activeTool: string | null;
  draft: string;
  setDraft: (value: string) => void;
  handleSubmit: (event: React.FormEvent) => void;
  /** Confirms a buddy-proposed action (the only path that mutates). */
  confirmAction: (messageId: string, action: ProposedAction) => void;
  /** Declines a proposed action; nothing changes. */
  dismissAction: (messageId: string, actionId: string) => void;
  /** Composer placeholder — "Type your answer…" while the buddy is intaking. */
  placeholder?: string;
  /** Rendered above the first message: what came back from the hire's PM. */
  before?: ReactNode;
  /** Rendered under the buddy's most recent reply — the greeting's suggested next step. */
  lastMessageFooter?: ReactNode;
  /** Rendered under each of the hire's own questions, handed that question's text. */
  renderQuestionAction?: (question: string) => ReactNode;
  /** Rendered just above the composer: the things this hire could usefully ask. */
  aboveComposer?: ReactNode;
  /** Why the conversation could not be brought on screen at all — see `BuddyThread`. */
  openError?: string | null;
  /** Tries the read again, from the banner that reports the failure. */
  onRetryOpen?: () => void;
  /** Puts the caret in the composer on mount — the page opens in order to be typed in. */
  focusComposerOnMount?: boolean;
};

/**
 * The `/buddy` conversation: the thread, and the box you answer it in.
 *
 * **No card, no panel, no chrome.** It used to be a bordered surface sitting in a page grid
 * beside a column of widgets, and the widgets were the problem — a box labelled "Ask about"
 * next to a box labelled "Not getting anywhere?" is a settings screen, not somebody you talk
 * to. What is left is what a conversation actually needs: the messages, and a place to write.
 * Everything the widgets used to hold has moved to where it belongs — the suggestions to the
 * composer they fill, the escalation offer to the hire's own question, and what came back from
 * a person to the rail beside all of it.
 *
 * The page owns the `app-page-frame` gutters that the PM dashboard, the knowledge base and
 * data ingestion use, and this fills the column left inside them — beside the rail when there
 * is one. The reading measure is kept on the *bubbles* instead of on this column: they hug
 * opposite edges and stop at a readable width, which is how a full-width thread stays legible
 * without narrowing the page it sits on.
 *
 * It scrolls down, never sideways — `overflow-x-hidden` plus the `min-w-0` chain running down
 * to `BuddyMarkdown`, where wide blocks get their own scrollers.
 */
export function BuddyConversation({
  messages,
  isThinking,
  activeTool,
  draft,
  setDraft,
  handleSubmit,
  confirmAction,
  dismissAction,
  placeholder,
  before,
  lastMessageFooter,
  renderQuestionAction,
  aboveComposer,
  openError,
  onRetryOpen,
  focusComposerOnMount = false,
}: BuddyConversationProps) {
  const { containerRef, onScroll } = useStickToBottom(messages);

  return (
    <>
      <div
        ref={containerRef}
        onScroll={onScroll}
        data-testid="buddy-transcript"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="app-page-frame flex min-w-0 flex-col gap-4 py-6">
          {/* The conversation as a whole, kept as one folded note.
              Above the thread rather than at the end of it, because the end of a conversation moves
              every time the buddy answers — an action that walks down the page as you talk is one
              you have to find again each time you want it.

              Only once the buddy has actually said something. A window holding the hire's question
              and nothing else is not a conversation worth freezing, and the buddy is often still
              typing the first answer when the page opens. */}
          {messages.some((message) => message.role === "ASSISTANT" && message.content !== "") && (
            <div className="flex justify-end">
              <SaveToBoard
                request={() =>
                  transcriptNote(
                    messages
                      .filter((message) => message.content !== "")
                      .map((message) => ({
                        speaker: message.role === "USER" ? "You" : "Buddy",
                        content: message.content,
                      })),
                    "You",
                  )
                }
                label="Keep this conversation"
                savedLabel="On your board"
                description="The whole thread, as one note you can fold open."
                icon={<MessagesSquare className="h-4 w-4" aria-hidden="true" />}
              />
            </div>
          )}

          <BuddyThread
            renderReplyAction={(reply) => (
              <div className="flex flex-wrap items-center gap-1">
                {/* Two different things, and the order says which is the better one. A list the
                    buddy wrote becomes a checklist you can tick; anything else can still be kept,
                    but only as the words it was. `SaveReplyToBoard` draws nothing when the reply
                    holds no list, so most replies show one button. */}
                <SaveReplyToBoard content={reply} />
                <SaveToBoard
                  request={() => buddyReplyNote(reply)}
                  label="Keep this answer"
                  savedLabel="On your board"
                  description="The reply, frozen as a note."
                  icon={<BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
                />
              </div>
            )}
            messages={messages}
            isThinking={isThinking}
            activeTool={activeTool}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            showNames
            before={before}
            lastMessageFooter={lastMessageFooter}
            renderQuestionAction={renderQuestionAction}
            openError={openError}
            onRetryOpen={onRetryOpen}
          />
        </div>
      </div>

      {/* Translucent rather than solid, so the thread does not stop dead at a hard line — the
                last message fades under the composer as it scrolls past it. */}
      <div className="shrink-0 border-t border-app-border bg-app-bg/85 backdrop-blur-md">
        <div className="app-page-frame py-3">
          {aboveComposer && <div className="mb-3 min-w-0">{aboveComposer}</div>}

          <BuddyComposer
            draft={draft}
            setDraft={setDraft}
            handleSubmit={handleSubmit}
            placeholder={placeholder}
            focusOnMount={focusComposerOnMount}
          />
        </div>
      </div>
    </>
  );
}
