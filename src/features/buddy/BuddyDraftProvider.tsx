import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { matchEggPhrase } from "../easter-eggs/lib/eggPhrases";
import { playEggEffect } from "../easter-eggs/eggEffectBus";
import { BuddyDraftActionsContext, BuddyDraftContext } from "./buddyDraftContext";
import type { BuddyDraft, BuddyDraftActions } from "./buddyDraftContext";
import { useBuddySession } from "./buddySessionContext";

/** The conversation the box is pointed at before the first open has resolved one. */
const UNRESOLVED_DRAFT_KEY = "__new__";

/** How long after the last keystroke a draft is written, in ms — the retired chat's window. */
const DRAFT_SAVE_DELAY_MS = 400;

function draftStorageKey(conversationKey: string): string {
  return `buddyDraft.${conversationKey}`;
}

/**
 * The key a draft is filed under: the team project it was written about, the conversation, or
 * the unresolved box. Session ids and `team:` keys never collide, so one namespace is enough.
 */
function draftKeyFor(currentSessionId: string | null, teamProjectId: string | null): string {
  if (teamProjectId !== null) return `team:${teamProjectId}`;
  return currentSessionId ?? UNRESOLVED_DRAFT_KEY;
}

function readDraft(conversationKey: string): string {
  try {
    return localStorage.getItem(draftStorageKey(conversationKey)) ?? "";
  } catch {
    // Private modes can refuse storage outright. An empty box is not a failure.
    return "";
  }
}

function writeDraft(conversationKey: string, draft: string): void {
  try {
    if (draft) localStorage.setItem(draftStorageKey(conversationKey), draft);
    else localStorage.removeItem(draftStorageKey(conversationKey));
  } catch {
    // Nothing to do: the box still works, it just will not be remembered.
  }
}

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
 * **And the words belong to their conversation.** Each draft is filed under the conversation it
 * was written about — `buddyDraft.<sessionId>`, `buddyDraft.team:<projectId>`, and
 * `buddyDraft.__new__` for the window before the first open resolves one — saved as the hire
 * switches away, read back when that conversation returns, and there across reloads. The retired
 * chat persisted its drafts the same way under `chatDraft.<id>`; without it, a question typed
 * about one conversation turned up in the next. The swap rides the conversation key rather than a
 * signal from the session: the key *is* the conversation, so there is nothing to keep in step.
 *
 * Two contexts, not one: the value changes per keystroke by design, and only the composer should
 * follow it. A surface that merely *fills* the box reads `BuddyDraftActions` and never re-renders
 * for a keystroke — see that type for why the distinction is load-bearing.
 */
export function BuddyDraftProvider({ children }: { children: ReactNode }) {
  const { submitMessage, currentSessionId, teamProjectId } = useBuddySession();
  const conversationKey = draftKeyFor(currentSessionId, teamProjectId);
  const [draft, setDraft] = useState(() => readDraft(conversationKey));

  /**
   * The key the box is currently holding words for. When the session moves on — a new
   * conversation, a selection, a project switch, the first open resolving — the draft of the
   * conversation being left is saved where it belongs and the arriving one's is loaded. React's
   * documented "adjust state when a prop changes" pattern — the same shape `BuddyPage` uses for
   * its rail, and named once with its rules in `CODING_STANDARDS.md` § 3 — rather than an
   * effect, because an effect here would paint one frame of a draft belonging to a conversation
   * that is no longer on screen, and cost a second render to fix it.
   */
  const [seenKey, setSeenKey] = useState(conversationKey);
  if (seenKey !== conversationKey) {
    if (seenKey === UNRESOLVED_DRAFT_KEY && draft) {
      // The first open resolved a conversation under words the hire already typed: the text
      // belongs to the conversation that just appeared, not to a box that never existed.
      writeDraft(conversationKey, draft);
      writeDraft(UNRESOLVED_DRAFT_KEY, "");
    } else {
      // Save the draft for the conversation we are leaving, then load the new one's.
      writeDraft(seenKey, draft);
      setDraft(readDraft(conversationKey));
    }
    setSeenKey(conversationKey);
  }

  // Debounced save while the hire types — the retired chat's window, so a reload lands on the
  // same words. An empty draft removes the entry rather than storing one: a box nobody has
  // touched is not a draft.
  useEffect(() => {
    const id = window.setTimeout(() => {
      writeDraft(conversationKey, draft);
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [conversationKey, draft]);

  /**
   * The one way a message leaves the box. The contract is unchanged from when this lived in the
   * session: an egg phrase plays its effect and is swallowed, anything else is cleared and handed
   * to the session — which sends it, or queues it behind a running answer — and the return value
   * says whether a turn actually started (the composer keeps the caret when one did not).
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
      // Cleared now, not only by the debounced save: a reload in the next 400 ms must not
      // resurrect a question that has already been asked.
      writeDraft(conversationKey, "");
      void submitMessage(text);
      return true;
    },
    [draft, submitMessage, conversationKey],
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
