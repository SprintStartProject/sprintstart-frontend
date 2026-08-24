import type { ReactNode } from "react";
import { Send } from "lucide-react";
import { AutoResizeTextarea } from "../../../components/ui/AutoResizeTextarea";
import { Button } from "../../../components/ui/Button";

type BuddyComposerProps = {
  draft: string;
  setDraft: (value: string) => void;
  handleSubmit: (event: React.FormEvent) => void;
  /** Composer placeholder — "Type your answer…" while the buddy is intaking. */
  placeholder?: string;
  /**
   * The quiet row under the composer: the escalation trigger, once the hire has asked
   * something the buddy could fail at. Sits *below* the box rather than above the transcript,
   * which is what stops it shoving the conversation down the page when it appears.
   */
  footer?: ReactNode;
};

/**
 * The buddy's message box.
 *
 * One rounded surface holds the field and the send button, and takes the focus ring as a
 * unit — the same composer shape the chat page draws, so the two places you type at a model
 * in this app are not two different controls. The field itself is `unstyled` for exactly that
 * reason: a bordered box inside a bordered box is the look this replaced.
 */
export function BuddyComposer({
  draft,
  setDraft,
  handleSubmit,
  placeholder = "Ask your buddy anything...",
  footer,
}: BuddyComposerProps) {
  return (
    <div className="shrink-0 border-t border-app-border bg-app-bg/80 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-2xl border border-app-border-muted bg-app-surface-muted p-2 shadow-sm transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
        >
          <AutoResizeTextarea
            value={draft}
            onChange={setDraft}
            placeholder={placeholder}
            minRows={1}
            maxRows={6}
            className="flex-1 px-2 py-2"
            submitOnEnter
            unstyled
          />

          <Button
            type="submit"
            variant="primary"
            iconOnly
            aria-label="Send message"
            disabled={!draft.trim()}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        {/* Both live under the composer, and the hint gives way when there is something
                    more useful to say. Two lines of small print under a message box is one more
                    than anybody reads. */}
        <div className="mt-2 min-h-5 px-1">
          {footer ?? (
            <p className="text-xs text-app-text-disabled">
              <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
              <kbd className="font-sans font-medium">Shift</kbd> +{" "}
              <kbd className="font-sans font-medium">Enter</kbd> for a new line
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
