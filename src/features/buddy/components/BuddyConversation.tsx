import type { ReactNode } from "react";
import type { BuddyMessageView, ProposedAction } from "../types";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyThread } from "./BuddyThread";
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
  /** Clears the previous conversation from the visit divider — see `BuddyThread`. */
  onStartFreshVisit?: () => void;
  /** The chord named in that control's tooltip, where the caller has actually bound one. */
  freshVisitShortcut?: string;
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
  onStartFreshVisit,
  freshVisitShortcut,
  hasFloatingControl = false,
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
        <div
          className={`app-page-frame flex min-w-0 flex-col gap-4 pb-6 ${
            hasFloatingControl ? "pt-16" : "pt-6"
          }`}
        >
          <BuddyThread
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
            onStartFreshVisit={onStartFreshVisit}
            freshVisitShortcut={freshVisitShortcut}
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
