import type { ComposerFlow } from "./useComposerFlow";
import type { ConversationParts } from "./useConversationParts";
import type { SessionFlow } from "./useSessionFlow";
import type { TurnFlow } from "./useTurnFlow";

type Flows = { turn: TurnFlow; session: SessionFlow; composer: ComposerFlow };

/** What is on screen, and the team target the conversation is about. */
function screenApi({ thread, team, proposals }: ConversationParts) {
  return {
    messages: thread.messages,
    isThinking: thread.isThinking,
    isStreaming: thread.isStreaming,
    activeTool: thread.activeTool,
    openerAction: thread.openerAction,
    isOpening: thread.isOpening,
    // Longer than `isOpening` — the greeting keeps streaming after the composer unlocks. The
    // switch gate reads it; a surface's own "opening" indicator does not need to.
    isGreeting: thread.isGreeting,
    openError: thread.openError,
    // Team mode: which managed project this conversation is about (`null` = the hire's own),
    // whether the manager asked for team mode at all, and whether a proposal decision is in flight
    // (it gates every operation that clears the transcript).
    teamProjectId: team.teamProjectId,
    isTeamMode: team.isTeamMode,
    isDeciding: proposals.isDeciding,
    presentedGreetingId: thread.presentedGreetingId,
    markGreetingPresented: thread.setPresentedGreetingId,
  };
}

/**
 * What the composer drives. The composer's words live in `BuddyDraftProvider`, keyed on
 * `currentSessionId`/`teamProjectId`; the wording of a proposal's fields lives with the session so it
 * survives a closed dock.
 */
function composerApi(parts: ConversationParts, { turn, composer }: Flows) {
  const { options, queue, proposals, dino } = parts;
  return {
    sendMessage: turn.sendMessage,
    stopStreaming: turn.stopStreaming,
    submitMessage: composer.submitMessage,
    retryReply: composer.retryReply,
    removeQueued: composer.removeQueued,
    pullQueuedMessage: composer.pullQueuedMessage,
    resumeQueue: composer.resumeQueue,
    switchTeamProject: composer.switchTeamProject,
    queued: queue.queued,
    queuePaused: queue.queuePaused,
    filters: options.filters,
    setFilters: options.setFilters,
    capabilitiesEnabled: options.capabilitiesEnabled,
    setCapabilitiesEnabled: options.setCapabilitiesEnabled,
    actionDrafts: proposals.actionDrafts,
    setActionDraft: proposals.setActionDraft,
    confirmAction: proposals.confirmAction,
    dismissAction: proposals.dismissAction,
    dinoGameActive: dino.dinoGameActive,
    closeDinoGame: dino.closeDinoGame,
    dinoUnlocked: dino.dinoUnlocked,
    registerDinoSurface: dino.registerDinoSurface,
  };
}

/**
 * The conversations on this surface: what the hire has, which one is on screen, and the moves across
 * them — a new one, a switch, and a bin. A new conversation starts empty — the composer is the
 * hire's from there.
 */
function conversationsApi({ sessionStore }: ConversationParts, { turn, session }: Flows) {
  return {
    sessions: sessionStore.sessions,
    currentSessionId: sessionStore.currentSessionId,
    newConversation: session.newConversation,
    selectSession: session.selectSession,
    binSession: session.binSession,
    isSessionBinned: session.isSessionBinned,
    refreshSessions: turn.refreshSessions,
    ensureOpened: session.ensureOpened,
    retryOpen: session.retryOpen,
  };
}

/** The one object every buddy surface reads, assembled from the conversation's parts and flows. */
export function buddySessionApi(parts: ConversationParts, flows: Flows) {
  return {
    ...screenApi(parts),
    ...composerApi(parts, flows),
    ...conversationsApi(parts, flows),
  };
}
