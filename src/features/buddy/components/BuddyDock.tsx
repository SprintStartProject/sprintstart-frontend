import { Maximize2 } from "lucide-react";
import { SidePanel } from "../../../components/ui/SidePanel";
import { SleepyBot } from "../../chatbot/components/SleepyBot";
import type { useBuddy } from "../hooks/useBuddy";
import { BuddyComposer } from "./BuddyComposer";
import { BuddySuggestionChips } from "./BuddySuggestionChips";
import { BuddyThinkingTurn, BuddyTurn } from "./BuddyTurn";

type BuddyDockProps = Pick<
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
  isOpen: boolean;
  onClose: () => void;
  /**
   * Opens the full page, carrying the draft. Omitted when there is nowhere to go — on
   * `/buddy` itself, where the control would offer the page the hire is already reading.
   */
  onOpenFull?: () => void;
};

/**
 * The buddy, slid in from the right edge over whatever page the hire is on.
 *
 * **It does not dim the page behind it**, and that is the design: the buddy is consulted
 * *about* what you are looking at, so covering it up would hide the thing you came to ask
 * about. It is `ui/SidePanel` with the overlay turned off — the drawer the admin views and
 * the team detail panels already use, so it slides on the app's one panel curve rather than
 * on a timing invented here, and brings Escape-to-close and focus restore with it.
 *
 * It replaced a hand-placed floating box (`fixed right-8 bottom-24 h-[32rem] w-96`), which was
 * a chat bubble stuck to the corner of a desktop app: it covered page content it did not need
 * to, it could not grow, and it looked like a widget from a different product.
 *
 * The transcript is the page's transcript, through the same `BuddyTurn` — one buddy, one voice,
 * whichever surface you meet it on. The dock is simply narrower, and the turns wrap into it.
 *
 * It scrolls down, never sideways. Wide content scrolls inside its own block; `min-w-0` down
 * the column is what lets it, because a flex/grid item's default `min-width: auto` refuses to
 * shrink below its content and the per-block scrollers then never engage.
 */
export function BuddyDock({
  messages,
  isThinking,
  draft,
  setDraft,
  handleSubmit,
  confirmAction,
  dismissAction,
  bottomRef,
  suggestions,
  isOpen,
  onClose,
  onOpenFull,
}: BuddyDockProps) {
  // Offered until the hire has said something this visit, then out of the way. A chip row is
  // for somebody who does not know what to type; once they have typed, the dock is narrow and
  // the conversation should have all of it.
  const hasUserMessage = messages.some((message) => message.role === "USER");
  const streamingId = messages[messages.length - 1]?.id;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      // The panel's own accessible name, and the one the widget's tests look for.
      title="Onboarding buddy"
      description="Ask about the codebase, or about your own onboarding."
      leading={
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft ring-1 ring-app-brand-border/60">
          <SleepyBot size={30} canSleep={false} className="text-app-brand-text" />
        </span>
      }
      actions={
        // The answer to "this is too small" is the page that already exists, rather than a
        // resizable dock: `/buddy` renders the same conversation through the same components
        // with room to spare, and needs no layout state kept correct across viewports. The
        // draft goes with it — a control that discarded what somebody was typing would be
        // worse than not offering one.
        onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            aria-label="Open the full buddy page"
            className="rounded-xl border border-app-border p-2 text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      }
      footer={
        <BuddyComposer
          draft={draft}
          setDraft={setDraft}
          handleSubmit={handleSubmit}
          // The hint belongs on the page, where there is room for it. In a 27rem dock it
          // costs a line the transcript would rather have.
          compact
        />
      }
      showOverlay={false}
      widthClassName="w-full max-w-md sm:w-[27rem]"
      // Above the launcher that opened it, so the two never fight over the corner.
      zIndexClassName="z-50"
      panelBackgroundClassName="bg-app-bg"
      headerClassName="px-5 py-4"
      contentClassName="flex min-w-0 flex-col gap-5 px-5 py-5"
      footerClassName="border-t border-app-border bg-app-bg px-5 py-4"
      closeAriaLabel="Minimise your buddy"
    >
      {messages.map((message) => {
        const isUser = message.role === "USER";
        const hasText = message.content.trim().length > 0;
        const hasActions = (message.actions?.length ?? 0) > 0;

        // The send loop appends an empty assistant message up front and streams into it.
        // Until the first token (or an action proposal) arrives it has nothing to show and
        // the thinking turn below already stands in for it, so skip it — otherwise a second
        // empty turn appears while the buddy is working.
        if (!isUser && !hasText && !hasActions) return null;

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

      {!hasUserMessage && (
        <BuddySuggestionChips suggestions={suggestions} onPick={setDraft} heading="Try asking" />
      )}

      <div ref={bottomRef} />
    </SidePanel>
  );
}
