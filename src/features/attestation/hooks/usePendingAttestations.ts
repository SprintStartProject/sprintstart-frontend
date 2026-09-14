import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attestationService } from "../../../services/attestationService";
import { queryKeys } from "../../../services/queryKeys";
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

type AnswerVariables = { id: string } & ({ kind: "accept" } | { kind: "sendBack"; reason: string });

/**
 * What is waiting on this person to confirm.
 *
 * An answered request leaves the queue rather than staying with a new badge: the queue is a list of
 * things still needing this person, and an item they have dealt with is noise in it. The hire sees
 * the outcome on their own ramp, which is where it matters. It leaves the cache list directly on
 * success rather than a refetch, since the backend has nothing more to tell this reader about it.
 *
 * A failed answer removes nothing. The card keeps showing what the backend actually holds, so a
 * failure can never look like it worked — the same rule the role-track table follows.
 */
export function usePendingAttestations(): UsePendingAttestationsResult {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.attestations.pending();

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => attestationService.fetchPending(),
  });

  const mutation = useMutation({
    mutationFn: (vars: AnswerVariables) =>
      vars.kind === "accept"
        ? attestationService.accept(vars.id)
        : attestationService.sendBack(vars.id, vars.reason),
    onSuccess: (_result, vars) => {
      queryClient.setQueryData(queryKey, (prev: Attestation[] | undefined) =>
        prev?.filter((item) => item.id !== vars.id),
      );
    },
  });

  const accept = async (id: string) => {
    try {
      await mutation.mutateAsync({ kind: "accept", id });
    } catch {
      // Surfaced below via `answerError`; callers don't need the rejection.
    }
  };

  const sendBack = async (id: string, reason: string) => {
    try {
      await mutation.mutateAsync({ kind: "sendBack", id, reason });
    } catch {
      // Surfaced below via `answerError`; callers don't need the rejection.
    }
  };

  return {
    pending: data ?? [],
    loading: isLoading,
    error: isError,
    answeringId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
    answerError: mutation.isError
      ? mutation.variables?.kind === "accept"
        ? "Could not confirm that. Try again in a moment."
        : "Could not send that back. Try again in a moment."
      : null,
    accept,
    sendBack,
  };
}
