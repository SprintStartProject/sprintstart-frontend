import type { ReactNode, RefObject } from "react";
import { MessagesSquare } from "lucide-react";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toolLabel } from "../toolLabel";
import { BuddyComposer } from "./BuddyComposer";
import { BuddyThinkingTurn, BuddyTurn } from "./BuddyTurn";

type BuddyConversationProps = {
  messages: BuddyMessageView[];
  isThinking: boolean;
  /** The tool the buddy is running right now, if any — shown as "Checking your progress…". */
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
  /**
   * Shown in place of the thread until the hire has said something (see `BuddyWelcome`).
   * Passed in rather than decided here so this component keeps one job: render a conversation.
   */
  welcome?: ReactNode;
};

/**
 * The conversation on the full page: a card in the page grid, not the page.
 *
 * A bounded surface — the app's ordinary `rounded-2xl` card, with its own title row, its own
 * scrolling body and the composer pinned to its bottom edge — so it sits beside
 * `BuddySidePanel` the way every other panel in this app sits inside a page.
 *
 * The transcript is `BuddyTurn`, the same one the dock renders: speakers under their own names
 * at one left margin, prose at a readable measure, no opposing bubbles. That is what stops a
 * wide desktop page reading as a phone messenger stretched sideways.
 *
 * It scrolls down, never sideways — `overflow-x-hidden` plus `min-w-0` down the column. The
 * card is wide, so an overflowing reply reads as a slightly odd layout rather than an obvious
 * bug, which is how such a regression survives review; see `BuddyMarkdown` for the per-block
 * half of the rule.
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
  welcome,
}: BuddyConversationProps) {
  // The send loop appends an empty assistant message up front and streams into it, so the
  // last turn is the one receiving tokens — that bot stays awake while every older one is
  // free to doze off.
  const streamingId = messages[messages.length - 1]?.id;

  return (
    <section
      aria-label="Conversation with your buddy"
      className="flex min-h-[32rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm xl:h-full xl:min-h-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-border-muted px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <MessagesSquare className="h-4 w-4 shrink-0 text-app-brand-text" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold text-app-text">Conversation</h2>
        </div>

        {/* What the buddy is *doing*, where a desktop app puts a status: in the panel's
                    title row. The thinking turn below carries the same label in the dock, where
                    there is no title row to put it in. */}
        {isThinking && activeTool && (
          <span
            role="status"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-app-brand-soft px-2.5 py-1 text-xs font-medium text-app-brand-text"
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-app-brand"
              aria-hidden="true"
            />
            {toolLabel(activeTool)}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {welcome ?? (
          <div className="flex min-w-0 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {messages.map((message) => {
              const isUser = message.role === "USER";
              const hasText = message.content.trim().length > 0;
              const hasActions = (message.actions?.length ?? 0) > 0;

              // Until the first token (or an action proposal) arrives the streaming
              // placeholder has nothing to show, and the thinking turn below already stands
              // in for it — so skip it, otherwise an empty second turn appears while the
              // buddy is working.
              if (!isUser && !hasText && !hasActions) {
                return null;
              }

              return (
                <BuddyTurn
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingId}
                  onConfirm={confirmAction}
                  onDismiss={dismissAction}
                />
              );
            })}

            {isThinking && <BuddyThinkingTurn />}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* The card supplies the composer's band; the composer itself draws no frame, so the
                dock can hand the same component to `SidePanel`'s footer. */}
      <div className="shrink-0 border-t border-app-border-muted bg-app-bg/40 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
        <BuddyComposer
          draft={draft}
          setDraft={setDraft}
          handleSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </div>
    </section>
  );
}
