import { Bot, Maximize2, Send, X } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { useBuddy } from "../hooks/useBuddy";
import { BuddyActionProposals } from "./BuddyActionProposals";
import { BuddyMarkdown } from "./BuddyMarkdown";
import { BuddySuggestionChips } from "./BuddySuggestionChips";

type BuddyPanelProps = Pick<
  ReturnType<typeof useBuddy>,
  | "messages"
  | "isThinking"
  | "draft"
  | "setDraft"
  | "handleSubmit"
  | "confirmAction"
  | "dismissAction"
  | "bottomRef"
  | "suggestions"
> & {
  onClose: () => void;
  /**
   * Opens the full-page conversation, carrying the draft. Omitted when there is nowhere to go —
   * on `/buddy` itself, where the control would offer the page the hire is already reading.
   */
  onOpenFull?: () => void;
};

/**
 * The persistent buddy's floating conversation panel. Bubble styling mirrors
 * the full-page buddy conversation so every buddy surface feels consistent.
 *
 * It scrolls down, never sideways. Wide content scrolls inside its own block; a horizontal
 * scrollbar across the whole conversation is the defect. Two CSS rules make that easy to
 * reintroduce:
 *
 * 1. `overflow-y: auto` computes `overflow-x` to `auto` too (CSS makes the pair non-`visible`
 *    together), so the transcript grows a sideways scrollbar the moment anything overflows. It is
 *    pinned shut, which is safe *because* of the second point.
 * 2. A flex item's default `min-width: auto` refuses to shrink below its content, so without
 *    `min-w-0` down the chain the bubble and its column grow to fit a wide code block and the
 *    `overflow-x-auto` on `pre` never engages.
 *
 * Vertical scrolling is intentional and stays.
 */
export function BuddyPanel({
  messages,
  isThinking,
  draft,
  setDraft,
  handleSubmit,
  confirmAction,
  dismissAction,
  bottomRef,
  suggestions,
  onClose,
  onOpenFull,
}: BuddyPanelProps) {
  // Offered until the hire has said something this visit, then out of the way. A chip row is for
  // somebody who does not know what to type; once they have typed, the panel is 384 px wide and
  // the conversation should have all of it.
  const hasUserMessage = messages.some((message) => message.role === "USER");

  return (
    <div
      role="dialog"
      aria-label="Onboarding buddy"
      className="fixed right-8 bottom-24 z-40 flex h-[32rem] max-h-[calc(100vh-8rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-app-brand-text" />
          <span className="text-sm font-semibold text-app-text">Buddy</span>
        </div>
        <div className="flex items-center gap-1">
          {/*
                      The answer to "this box is too small" is the page that already exists, rather
                      than a resizable panel: /buddy renders the same conversation through the same
                      components with room to spare, and needs no layout state kept correct across
                      viewports. The draft goes with it -- a control that discarded what somebody
                      was typing would be worse than not offering one.
                    */}
          {onOpenFull && (
            <button
              type="button"
              onClick={onOpenFull}
              title="Open the full conversation"
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-app-text-muted transition-colors hover:bg-app-surface-muted hover:text-app-text"
            >
              <Maximize2 size={14} aria-hidden="true" />
              Open full
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close buddy chat"
            className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-muted hover:text-app-text"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div
        data-testid="buddy-panel-transcript"
        className="flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="flex min-w-0 flex-col gap-4 px-4 py-4">
          {messages.map((message) => {
            const isUser = message.role === "USER";
            const hasText = message.content.trim().length > 0;
            const hasActions = (message.actions?.length ?? 0) > 0;

            // The empty assistant placeholder streams in later; the `isThinking`
            // indicator already stands in for it, so skip it to avoid a second empty
            // bubble while the buddy is thinking.
            if (!isUser && !hasText && !hasActions) {
              return null;
            }

            return (
              <div
                key={message.id}
                className={`flex w-full gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isUser ? "" : "bg-app-surface-muted"
                  }`}
                >
                  {isUser ? (
                    <UserAvatar fallbackName="You" size={28} />
                  ) : (
                    <Bot size={14} className="text-app-brand-text" />
                  )}
                </div>

                <div
                  className={`flex max-w-[80%] min-w-0 flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  {hasText && (
                    <div
                      className={`max-w-full min-w-0 rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
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
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-surface-muted">
                <Bot size={14} className="text-app-brand-text" />
              </div>

              <div className="flex max-w-[80%] flex-col items-start">
                <div className="rounded-2xl rounded-tl-none bg-app-surface-muted px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="border-t border-app-border bg-app-bg p-3">
        {/* Above the composer, not above the transcript: the chips exist to answer "what do
                    I type here", so they belong next to the box they fill. `min-w-0` for the reason
                    everything else in this panel has it -- a flex child that will not shrink is
                    what makes a 384 px column overflow sideways. */}
        {!hasUserMessage && (
          <div className="mb-3 min-w-0">
            <BuddySuggestionChips
              suggestions={suggestions}
              onPick={setDraft}
              heading="Try asking"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <AutoResizeTextarea
            value={draft}
            onChange={setDraft}
            placeholder="Ask your buddy..."
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
      </footer>
    </div>
  );
}
