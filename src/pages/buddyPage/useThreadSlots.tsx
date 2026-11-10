import { useCallback, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useIsSmUp } from "../../hooks/useIsSmUp";
import { BuddyQuestionActions } from "../../features/buddy/components/BuddyQuestionActions";
import { BuddySuggestionChips } from "../../features/buddy/components/BuddySuggestionChips";
import { useBuddySuggestions } from "../../features/buddy/hooks/useBuddySuggestions";
import type { useGreetingReveal } from "../../features/buddy/hooks/useGreetingReveal";
import type { BuddySession } from "./buddyPageTypes";

type ThreadSlotsInput = {
  session: BuddySession;
  greeting: ReturnType<typeof useGreetingReveal>;
  isHireMode: boolean;
  hasUserMessage: boolean;
  setDraft: (text: string) => void;
};

/**
 * The props the transcript's memo compares, each held in one identity.
 *
 * `BuddyThread` and its rows are memoised — that is what keeps a keystroke, and each streamed
 * token, from re-rendering every reply in the conversation — and any of these built inline would
 * hand the thread a new prop on every render of the page. Each one's dependencies are what it is
 * actually made of.
 */
export function useThreadSlots({
  session,
  greeting,
  isHireMode,
  hasUserMessage,
  setDraft,
}: ThreadSlotsInput) {
  const { openerAction, sendMessage, retryOpen } = session;
  const isSmUp = useIsSmUp();
  // Hire-only: the suggestions describe the *hire's* next useful question, and the backend has no
  // team-scoped list, so a team-mode conversation asks for none and shows no chips.
  const suggestions = useBuddySuggestions(isHireMode);

  const renderQuestionAction = useCallback(
    (question: string) => (isHireMode ? <BuddyQuestionActions question={question} /> : undefined),
    [isHireMode],
  );
  const retryOpenAction = useCallback(() => void retryOpen(), [retryOpen]);

  // The greeting's own next step, offered where a messenger offers a quick reply: right under the
  // message that suggested it. It sends on one click, unlike the chips, because accepting
  // something the mentor just offered is not composing a question of your own.
  const lastMessageFooter = useMemo(
    () =>
      !hasUserMessage && openerAction && !greeting.isRevealing ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-1.5"
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => void sendMessage(openerAction.question)}
        >
          {openerAction.label}
        </Button>
      ) : undefined,
    [hasUserMessage, openerAction, greeting.isRevealing, sendMessage],
  );

  // The chips *fill* the composer instead of sending, which is why they sit on top of it: the
  // words stay the hire's, and they can edit the question first. The list is the backend's, built
  // from the tools it actually mounts for this hire. Fewer chips on phones, not smaller ones.
  const aboveComposer = useMemo(
    () =>
      isHireMode && !hasUserMessage ? (
        <BuddySuggestionChips
          suggestions={suggestions}
          onPick={setDraft}
          heading="Not sure where to start?"
          limit={isSmUp ? undefined : 3}
        />
      ) : undefined,
    [isHireMode, hasUserMessage, suggestions, setDraft, isSmUp],
  );

  return { renderQuestionAction, retryOpenAction, lastMessageFooter, aboveComposer };
}
