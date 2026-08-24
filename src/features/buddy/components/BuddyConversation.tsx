import type { ReactNode, RefObject } from "react";
import type { BuddyMessageView, ProposedAction } from "../types";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyThread } from "./BuddyThread";

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
  bottomRef: RefObject<HTMLDivElement | null>;
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
};

/**
 * The `/buddy` conversation: the thread, and the box you answer it in.
 *
 * **No card, no panel, no chrome.** It used to be a bordered surface sitting in a page grid
 * beside a column of widgets, and the widgets were the problem — a box labelled "Ask about"
 * next to a box labelled "Not getting anywhere?" is a settings screen, not somebody you talk
 * to. What is left is what a conversation actually needs: the messages, and a place to write.
 * Everything the widgets used to hold has moved to where it belongs — the suggestions to the
 * composer they fill, the escalation offer to the answer that prompted it.
 *
 * It sits in the same `app-page-frame` gutters as the PM dashboard, the knowledge base and
 * data ingestion, so this page lines up with its siblings rather than being a narrow column
 * floating in the middle of them. The reading measure is kept on the *bubbles* instead: they
 * hug opposite edges and stop at a readable width, which is how a full-width thread stays
 * legible — capping the column would have put the gutters back by another name.
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
  bottomRef,
  placeholder,
  before,
  lastMessageFooter,
  renderQuestionAction,
  aboveComposer,
}: BuddyConversationProps) {
  return (
    <>
      <div
        data-testid="buddy-transcript"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="app-page-frame flex min-w-0 flex-col gap-4 py-8">
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
          />

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Translucent rather than solid, so the thread does not stop dead at a hard line — the
                last message fades under the composer as it scrolls past it. */}
      <div className="shrink-0 border-t border-app-border bg-app-bg/85 backdrop-blur-md">
        <div className="app-page-frame py-4">
          {aboveComposer && <div className="mb-3 min-w-0">{aboveComposer}</div>}

          <BuddyComposer
            draft={draft}
            setDraft={setDraft}
            handleSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </div>
      </div>
    </>
  );
}
