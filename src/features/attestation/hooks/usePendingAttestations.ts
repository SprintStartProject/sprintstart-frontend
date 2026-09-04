import { useCallback, useState } from "react";
import { useFetch } from "../../../hooks/useFetch";
import { attestationService } from "../../../services/attestationService";
import type { Attestation } from "../types";

export interface UsePendingAttestationsResult {
  pending: Attestation[];
  loading: boolean;
  error: boolean;
  /** The request currently being answered, so only its own card shows a pending state. */
  answeringId: string | null;
  answerError: string | null;
  accept: (id: string) => Promise<void>;
  sendBack: (id: string, reason: string) => Promise<void>;
}

/**
 * What is waiting on this person to confirm.
 *
 * An answered request leaves the queue rather than staying with a new badge: the queue is a list of
 * things still needing this person, and an item they have dealt with is noise in it. The hire sees
 * the outcome on their own ramp, which is where it matters.
 *
 * A failed answer removes nothing. The card keeps showing what the backend actually holds, so a
 * failure can never look like it worked — the same rule the role-track table follows.
 */
export function usePendingAttestations(): UsePendingAttestationsResult {
  const { data, loading, error } = useFetch<Attestation[]>(
    () => attestationService.fetchPending(),
    [],
  );

  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const answer = useCallback(async (id: string, run: () => Promise<unknown>, failure: string) => {
    setAnsweringId(id);
    setAnswerError(null);
    try {
      await run();
      setAnsweredIds((current) => [...current, id]);
    } catch {
      setAnswerError(failure);
    } finally {
      setAnsweringId(null);
    }
  }, []);

  const accept = useCallback(
    (id: string) =>
      answer(
        id,
        () => attestationService.accept(id),
        "Could not confirm that. Try again in a moment.",
      ),
    [answer],
  );

  const sendBack = useCallback(
    (id: string, reason: string) =>
      answer(
        id,
        () => attestationService.sendBack(id, reason),
        "Could not send that back. Try again in a moment.",
      ),
    [answer],
  );

  const pending = (data ?? []).filter((item) => !answeredIds.includes(item.id));

  return { pending, loading, error, answeringId, answerError, accept, sendBack };
}
