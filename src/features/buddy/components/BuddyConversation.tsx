import { memo, useCallback } from "react";
import type { ReactNode } from "react";
import type { BuddyMessageView, ProposedAction } from "../types";
import type { ActionDrafts } from "../actionDrafts";
import type { SelectedCitation } from "../citations/types";
import type { CitationArtifactOpen } from "../citations/citationArtifact";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyThread } from "./BuddyThread";
import { BuddyReplyActions } from "./BuddyReplyActions";
import { MessagesSquare } from "lucide-react";
import { SaveToBoard } from "../../board/save/SaveToBoard";
import { transcriptNote } from "../../board/generation/chatToCard";
import { useStickToBottom } from "../hooks/useStickToBottom";
import { RAIL_TOGGLE_CLEARANCE } from "../../../components/layout/ConversationRail";

type BuddyConversationProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /** The tool the buddy is running right now, if any — becomes "Checking your progress…". */
  activeTool: string | null;
  /** Confirms a buddy-proposed action (the only path that mutates). */
  confirmAction: (messageId: string, action: ProposedAction) => void;
  /** Declines a proposed action; nothing changes. */
  dismissAction: (messageId: string, action: ProposedAction) => void;
  /** The session's wording for offers that carry an editable message — see `actionDrafts`. */
  actionDrafts: ActionDrafts;
  /** Records one, so it outlives whichever surface is on screen. */
  setActionDraft: (key: string, text: string) => void;
  /** Composer placeholder — "Type your answer…" while the buddy is intaking. */
  placeholder?: string;
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
  /**
   * Leaves room at the top of the thread for a control floating over it.
   *
   * The rail's reopen button hangs in that corner rather than sitting in a bar of its own, so
   * without this the first message starts underneath it. Only when there is one: 40px of empty
   * page above every conversation to make room for a button most hires never see would be the
   * wrong way round.
   */
  hasFloatingControl?: boolean;
  /** Puts the caret in the composer on mount — the page opens in order to be typed in. */
  focusComposerOnMount?: boolean;
  /**
   * Whether the buddy's reply is actively streaming in.
   *
   * Read by the composer's focus dance only: together with `isThinking` this is
   * "the buddy is still writing", and the caret returns to the box when that
   * ends. Kept separate from `isThinking` because they are genuinely different
   * states — the thinking dots stop at the first token while the answer keeps
   * arriving — and folding streaming into `isThinking` would change what the
   * thread draws.
   */
  isStreaming?: boolean;
  /** Whether the dino waiting-game is open while the buddy thinks (see `BuddyThread`). */
  dinoGameActive?: boolean;
  /** Called when the player leaves the dino waiting-game. */
  onDinoGameExit?: () => void;
  /**
   * Called when the hire clicks a `[N]` citation reference in a reply.
   *
   * Held in one identity by the page, like the render callbacks above — the thread's memo
   * compares it.
   */
  onCitationClick?: (citation: SelectedCitation) => void;
  /** Opens the artifact drawer from a reply's citations footer — see `BuddyThread`. */
  onOpenArtifact?: (data: CitationArtifactOpen) => void;
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
function BuddyConversationImpl({
  messages,
  isThinking,
  activeTool,
  confirmAction,
  dismissAction,
  actionDrafts,
  setActionDraft,
  placeholder,
  lastMessageFooter,
  renderQuestionAction,
  aboveComposer,
  openError,
  onRetryOpen,
  hasFloatingControl = false,
  focusComposerOnMount = false,
  isStreaming = false,
  dinoGameActive = false,
  onDinoGameExit,
  onCitationClick,
  onOpenArtifact,
}: BuddyConversationProps) {
  const { containerRef, onScroll } = useStickToBottom(messages);

  /**
   * The row under every reply, held in one identity for the life of this component.
   *
   * `BuddyThread` is memoised — that is what keeps a keystroke out of the thread — and a
   * callback created inline would hand it a new prop on every render, defeating exactly that.
   */
  const renderReplyAction = useCallback(
    (reply: string, message: BuddyMessageView) => (
      <BuddyReplyActions reply={reply} message={message} />
    ),
    [],
  );

  return (
    <>
      <div
        ref={containerRef}
        onScroll={onScroll}
        data-testid="buddy-transcript"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <div
          className={`app-page-frame flex min-w-0 flex-col gap-4 pb-6 ${
            hasFloatingControl ? RAIL_TOGGLE_CLEARANCE : "pt-8"
          }`}
        >
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
            renderReplyAction={renderReplyAction}
            messages={messages}
            isThinking={isThinking}
            isStreaming={isStreaming}
            activeTool={activeTool}
            confirmAction={confirmAction}
            dismissAction={dismissAction}
            actionDrafts={actionDrafts}
            setActionDraft={setActionDraft}
            showNames
            lastMessageFooter={lastMessageFooter}
            renderQuestionAction={renderQuestionAction}
            openError={openError}
            onRetryOpen={onRetryOpen}
            dinoGameActive={dinoGameActive}
            onDinoGameExit={onDinoGameExit}
            onCitationClick={onCitationClick}
            onOpenArtifact={onOpenArtifact}
          />
        </div>
      </div>

      {/* Translucent rather than solid, so the thread does not stop dead at a hard line — the
                last message fades under the composer as it scrolls past it. */}
      <div className="shrink-0 border-t border-app-border bg-app-bg/85 backdrop-blur-md">
        <div className="app-page-frame py-3">
          {aboveComposer && <div className="mb-3 min-w-0">{aboveComposer}</div>}

          <BuddyComposer
            placeholder={placeholder}
            focusOnMount={focusComposerOnMount}
            busy={isThinking || isStreaming}
            gameActive={dinoGameActive}
          />
        </div>
      </div>
    </>
  );
}

/**
 * Memoised, and its props are the contract: everything in that list is a plain value, an element
 * or callback the page holds in one identity (see the `useMemo`/`useCallback`s above its render),
 * or a motion value. A fresh inline element added to it later — a `footer={`…`}` built in the
 * page's render — is silently the one prop that always changed, and the memo stops paying.
 *
 * The thread *inside* this carries the per-message boundary; this one is about the page's own
 * re-renders (the rail opening, a toast landing, a conversation switch) not walking the whole
 * conversation.
 */
export const BuddyConversation = memo(BuddyConversationImpl);
