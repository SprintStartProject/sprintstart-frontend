import type { ReactNode } from "react";
import { BuddyConversation } from "../../features/buddy/components/BuddyConversation";
import type { useCitationViewer } from "../../features/buddy/citations/useCitationViewer";
import type { useGreetingReveal } from "../../features/buddy/hooks/useGreetingReveal";
import type { BuddySession } from "./buddyPageTypes";
import type { useThreadSlots } from "./useThreadSlots";

type BuddyHomeConversationProps = {
  session: BuddySession;
  greeting: ReturnType<typeof useGreetingReveal>;
  slots: ReturnType<typeof useThreadSlots>;
  viewer: ReturnType<typeof useCitationViewer>;
  citationProjectId: string | null | undefined;
  composerFocusToken: number;
  /** The rail toggle and the new-conversation button float over the top corners exactly while the rail is shut. */
  hasFloatingControl: boolean;
};

/** The shared session's conversation, wired to this page's slots, citations and floating controls. */
export function BuddyHomeConversation({
  session,
  greeting,
  slots,
  viewer,
  citationProjectId,
  composerFocusToken,
  hasFloatingControl,
}: BuddyHomeConversationProps): ReactNode {
  const { isThinking, isStreaming, isOpening } = session;

  return (
    <BuddyConversation
      messages={greeting.messages}
      isThinking={isThinking || isOpening || greeting.isThinking}
      isStreaming={isStreaming}
      turnActive={isThinking || isStreaming}
      onStop={session.stopStreaming}
      queue={{
        items: session.queued,
        paused: session.queuePaused,
        onRemove: session.removeQueued,
        onPull: session.pullQueuedMessage,
        onSendQueued: session.resumeQueue,
      }}
      filters={session.filters}
      onFiltersChange={session.setFilters}
      capabilitiesEnabled={session.capabilitiesEnabled}
      onCapabilitiesChange={session.setCapabilitiesEnabled}
      composerFocusToken={composerFocusToken}
      activeTool={session.activeTool}
      confirmAction={session.confirmAction}
      dismissAction={session.dismissAction}
      actionDrafts={session.actionDrafts}
      setActionDraft={session.setActionDraft}
      dinoGameActive={session.dinoGameActive}
      onDinoGameExit={session.closeDinoGame}
      // Held in one identity (see `useThreadSlots`) — the thread's memo compares them.
      lastMessageFooter={slots.lastMessageFooter}
      // Hire-flow only: "Send this to your PM" escalates the hire's own question, and a team-mode
      // conversation is not one — the offer must not even render there.
      renderQuestionAction={slots.renderQuestionAction}
      openError={session.openError}
      onRetryOpen={slots.retryOpenAction}
      onRetryReply={session.retryReply}
      // A `[N]` click opens the popover, and the footer's "Open source" hands the artifact to the
      // drawer. With no project to open a drawer in, pass no artifact opener, so the popover (and
      // the footer's chips) fall back to the external source link instead of dead-ending.
      onCitationClick={viewer.handleCitationClick}
      onOpenArtifact={citationProjectId ? viewer.handleOpenArtifact : undefined}
      hasFloatingControl={hasFloatingControl}
      aboveComposer={slots.aboveComposer}
      focusComposerOnMount
    />
  );
}
