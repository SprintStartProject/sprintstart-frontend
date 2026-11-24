import { threadBusy } from "../conversation/openFailure";
import type { ProjectSelectionSlice } from "../conversation/projectSelection";
import type { ConversationParts } from "./useConversationParts";
import type { SessionFlow } from "./useSessionFlow";
import type { TurnFlow } from "./useTurnFlow";
import { useQueueControls } from "./useQueueControls";
import { useTargetSwitch } from "./useTargetSwitch";

/**
 * What the composer and the mode switcher drive: the send queue, and aiming the buddy at a project.
 *
 * `busy` is everything the thread cannot be cleared under: a turn, an opening read, a greeting, a
 * proposal decision.
 */
export function useComposerFlow(
  parts: ConversationParts,
  turn: TurnFlow,
  session: SessionFlow,
  selection: ProjectSelectionSlice,
) {
  const { thread, team, queue, proposals, latches, clearThread } = parts;

  const controls = useQueueControls({
    ...queue,
    tracker: turn.tracker,
    sendMessage: turn.sendMessage,
    messagesNow: thread.messagesNow,
  });

  const { switchTeamProject } = useTargetSwitch({
    ...team,
    selection,
    latches,
    clearThread,
    setIsThinking: thread.setIsThinking,
    setIsStreaming: thread.setIsStreaming,
    ensureOpened: session.ensureOpened,
    decidingNow: proposals.decidingNow,
    busy: threadBusy({ ...thread, isDeciding: proposals.isDeciding }),
  });

  return { ...controls, switchTeamProject };
}

export type ComposerFlow = ReturnType<typeof useComposerFlow>;
