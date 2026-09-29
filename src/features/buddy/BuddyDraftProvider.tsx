import { useCallback, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { matchEggPhrase } from "../easter-eggs/lib/eggPhrases";
import { playEggEffect } from "../easter-eggs/eggEffectBus";
import { BuddyDraftActionsContext, BuddyDraftContext } from "./buddyDraftContext";
import type { BuddyDraft, BuddyDraftActions } from "./buddyDraftContext";
import { useBuddySession } from "./buddySessionContext";

/**
 * Owns the composer's words — one box for both buddy surfaces.
 *
 * **Why it is a provider of its own, *under* the session's.** The draft used to be a piece of
 * `useBuddyConversation`, so typing in it re-rendered every reader of the session: on `/buddy`
 * that is the whole page, and with it every reply in the thread, each one re-parsed by
 * `ReactMarkdown` (issue #236 — the composer grew sluggish as a conversation grew). Down here
 * the state is a step further from everything else: a keystroke re-renders this provider and the
 * composer that reads it, and nothing else. The page, the dock and the widget are all `children`,
 * whose elements never change identity, so React leaves them where they are.
 *
 * The words still outlive the dock — close it mid-sentence and they are there next time — because
 * this provider lives as long as the app's one session, not as long as any one surface.
 *
 * Two contexts, not one: the value changes per keystroke by design, and only the composer should
 * follow it. A surface that merely *fills* the box reads `BuddyDraftActions` and never re-renders
 * for a keystroke — see that type for why the distinction is load-bearing.
 */
export function BuddyDraftProvider({ children }: { children: ReactNode }) {
  const { sendMessage, draftResetToken } = useBuddySession();
  const [draft, setDraft] = useState("");

  /**
   * A fresh visit or a project switch replaced the conversation on screen, so the words in the
   * box went with it — they were a question about the thread that is gone.
   *
   * Told, not pulled: the session sits *above* this provider and cannot reach into its state, so
   * it bumps a token and the clearing happens on the way through. React's documented "adjust
   * state when a prop changes" pattern — the same shape `BuddyPage` uses for its rail, and named
   * once with its rules in `CODING_STANDARDS.md` § 3 — rather than an effect, because an effect
   * here would paint one frame of a draft belonging to a conversation that no longer exists, and
   * cost a second render to fix it.
   */
  const [seenResetToken, setSeenResetToken] = useState(draftResetToken);
  if (seenResetToken !== draftResetToken) {
    setSeenResetToken(draftResetToken);
    setDraft("");
  }

  /**
   * The one way a message leaves the box. The contract is unchanged from when this lived in the
   * session: an egg phrase plays its effect and is swallowed, anything else is cleared and sent,
   * and the return value says whether a turn actually started (the composer keeps the caret when
   * one did not).
   */
  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      // Easter-egg phrases are intercepted before anything is sent: the effect plays app-wide
      // (EggEffectsLayer) and the message is swallowed silently — no reply, no request. Same
      // contract as the AI chat.
      const eggEffect = matchEggPhrase(draft);
      if (eggEffect) {
        setDraft("");
        playEggEffect(eggEffect);
        return false;
      }

      const text = draft;
      if (!text.trim()) return false;

      setDraft("");
      void sendMessage(text);
      return true;
    },
    [draft, sendMessage],
  );

  const value = useMemo<BuddyDraft>(
    // `setDraft` is a state setter — stable for this provider's lifetime — so it is deliberately
    // not a dependency. The value is new exactly when the words, or the submit behaviour, are.
    () => ({ draft, setDraft, handleSubmit }),
    [draft, handleSubmit],
  );

  // Built once and never again: the setter it carries never changes, which is the whole point of
  // handing surfaces this half instead of the value.
  const actions = useMemo<BuddyDraftActions>(() => ({ setDraft }), []);

  return (
    <BuddyDraftActionsContext.Provider value={actions}>
      <BuddyDraftContext.Provider value={value}>{children}</BuddyDraftContext.Provider>
    </BuddyDraftActionsContext.Provider>
  );
}
