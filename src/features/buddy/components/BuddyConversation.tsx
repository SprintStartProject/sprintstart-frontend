import { Bot, Send } from "lucide-react";
import type { RefObject } from "react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { BuddyMessageView, ProposedAction } from "../types";
import { toolLabel } from "../toolLabel";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";

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
};

/**
 * The full-page buddy conversation used by the `/buddy` home. Shares the bubble styling of
 * the floating [BuddyPanel] so both surfaces feel like the same companion, but lays out for
 * a page and surfaces what the buddy is *doing* (a tool label) rather than a bare spinner.
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
  placeholder = "Ask your buddy anything...",
}: BuddyConversationProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Same rule as the floating panel, and not merely defensive here: this page is wide,
                so an overflowing reply reads as a slightly odd layout rather than an obvious bug —
                which is how it would go unnoticed. See BuddyPanel for why min-w-0 is the fix. */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 px-4 py-4">
          {messages.map((message) => {
            const isUser = message.role === "USER";
            const hasText = message.content.trim().length > 0;
            const hasActions = (message.actions?.length ?? 0) > 0;

            // The send loop appends an empty assistant message up front and streams
            // into it. Until the first token (or an action proposal) arrives it has
            // nothing to show, and the `isThinking` indicator below already stands in
            // for it — so skip it, otherwise an empty second bubble appears while the
            // buddy is thinking.
            if (!isUser && !hasText && !hasActions) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`flex w-full gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser ? "" : "bg-app-surface-muted"
                  }`}
                >
                  {isUser ? (
                    <UserAvatar fallbackName="You" size={32} />
                  ) : (
                    <Bot size={16} className="text-app-brand-text" />
                  )}
                </div>

                <div
                  className={`flex max-w-[80%] min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  {hasText && (
                    <div
                      className={`max-w-full min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                        isUser
                          ? "rounded-tr-none bg-app-brand whitespace-pre-wrap text-white"
                          : "rounded-tl-none bg-app-surface-muted text-app-text"
                      }`}
                    >
                      {isUser ? message.content : <BuddyMarkdown content={message.content} />}
                    </div>
                  )}

                  {!isUser && message.actions && message.actions.length > 0 && (
                    <BuddyActionProposals
                      messageId={message.id}
                      actions={message.actions}
                      onConfirm={confirmAction}
                      onDismiss={dismissAction}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="flex w-full gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted">
                <Bot size={16} className="text-app-brand-text" />
              </div>

              <div className="flex max-w-[80%] flex-col items-start">
                <div className="rounded-2xl rounded-tl-none bg-app-surface-muted px-4 py-2.5">
                  {activeTool ? (
                    <span className="text-sm text-app-text-muted">{toolLabel(activeTool)}</span>
                  ) : (
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-app-border bg-app-bg">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-4"
        >
          <AutoResizeTextarea
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            minRows={1}
            maxRows={6}
            className="flex-1"
            submitOnEnter
          />

          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-brand text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
