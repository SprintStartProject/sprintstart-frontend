import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useBuddyDraftActions } from "../features/buddy/buddyDraftContext";
import { withSeed } from "../features/buddy/hooks/useBuddy";

/**
 * Hands a prompt to the buddy and takes the reader there.
 *
 * The composer is filled but **not** submitted — the same contract the dashboard's quick
 * ask and the buddy's suggestion chips already use — so a mis-aimed selection costs an
 * edit rather than a message. Seeded into the one conversation the buddy keeps, which is
 * the point of a one-surface buddy: the question lands where the hire's history lives.
 *
 * Returns `false` only for an empty prompt; the buddy is always there to hand it to.
 */
export function useAskAi(): (prompt: string) => boolean {
  const navigate = useNavigate();
  const { setDraft } = useBuddyDraftActions();

  return useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return false;

      setDraft((current) => withSeed(current, trimmed));
      void navigate("/buddy");

      return true;
    },
    [navigate, setDraft],
  );
}
