import { useCallback, useEffect, useState } from "react";
import { arrivalService } from "../../../services/arrivalService";
import type {
  ArrivalStep,
  CreateArrivalStepRequest,
  DerivableArrivalStep,
  UpdateArrivalStepRequest,
} from "../types";

/**
 * The arrival step list for one scope, for the people who author it.
 *
 * `projectId` is the scope: null means company-wide, which is the same convention the model and
 * the wire use — absent scope is not excluded scope, and it is passed explicitly rather than left
 * implicit.
 *
 * The derivable catalog is loaded with the list rather than separately, because its `added` flags
 * describe that same list and the two going out of step would offer to add something twice.
 *
 * The catalog's `added` flags always describe the company-wide list, because a derivation is
 * code and the same key can only be derived once. A project scope therefore shows them as offers it
 * should not make — which is why the caller hides the catalog outside the company scope rather than
 * this hook silently filtering it.
 */
export function useArrivalAuthoring(projectId: string | null = null) {
  const [steps, setSteps] = useState<ArrivalStep[] | null>(null);
  const [derivable, setDerivable] = useState<DerivableArrivalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Settled separately: the authored list is the page, and the catalog is an offer on top
      // of it. A catalog that will not load must not take the list down with it.
      const [authored, catalog] = await Promise.allSettled([
        arrivalService.listSteps(projectId),
        arrivalService.listDerivableSteps(),
      ]);

      if (authored.status === "rejected") throw authored.reason;
      setSteps(authored.value);
      setDerivable(catalog.status === "fulfilled" ? catalog.value : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // Deferred to a microtask: React 19 rejects a synchronous first setState in an effect body,
    // and this is the pattern the rest of the app uses for it.
    void (async () => {
      await load();
    })();
  }, [load]);

  /** Runs a write, then re-reads — the server owns ordering and normalisation, not this hook. */
  const write = useCallback(
    async (action: () => Promise<unknown>, failureMessage: string): Promise<boolean> => {
      setWriteError(null);
      try {
        await action();
        await load();
        return true;
      } catch {
        setWriteError(failureMessage);
        return false;
      }
    },
    [load],
  );

  // The scope is the hook's, not the form's: a create form that had to remember which scope it
  // was in could disagree with the list it is adding to, and the wire has no way to notice.
  const create = useCallback(
    async (request: CreateArrivalStepRequest) =>
      await write(
        async () => await arrivalService.createStep({ ...request, projectId }),
        "That step could not be added. A step with that key may already exist.",
      ),
    [write, projectId],
  );

  /**
   * Adds a step the system can check for itself, using its suggested wording.
   *
   * Nothing about *how* it is settled is sent: the backend binds a known key to its derivation
   * and overrides `settledBy` and `selfConfirmable` whatever a caller asks for, so sending them
   * here would be a second opinion that never wins. The wording is only a starting point — it is
   * an ordinary step afterwards, editable and removable like any other.
   */
  const addDerivable = useCallback(
    async (derivation: DerivableArrivalStep) =>
      await write(
        async () =>
          await arrivalService.createStep({
            key: derivation.key,
            projectId,
            title: derivation.suggestedTitle,
            description: derivation.suggestedDescription,
          }),
        "That step could not be added. It may already be on the list.",
      ),
    [write, projectId],
  );

  const update = useCallback(
    async (key: string, request: UpdateArrivalStepRequest) =>
      await write(
        async () => await arrivalService.updateStep(key, request, projectId),
        "That change could not be saved.",
      ),
    [write, projectId],
  );

  /**
   * Moves one step, and sends the whole resulting order.
   *
   * Never a from/to pair: two people reordering at once cannot then interleave into an order
   * neither of them chose.
   */
  const move = useCallback(
    async (key: string, direction: "up" | "down") => {
      if (!steps) return false;
      const index = steps.findIndex((step) => step.key === key);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= steps.length) return false;

      const reordered = [...steps];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

      return await write(
        async () =>
          await arrivalService.reorderSteps(
            reordered.map((step) => step.key),
            projectId,
          ),
        "That order could not be saved.",
      );
    },
    [steps, write, projectId],
  );

  const remove = useCallback(
    async (key: string) =>
      await write(
        async () => await arrivalService.deleteStep(key, projectId),
        "That step could not be removed.",
      ),
    [write, projectId],
  );

  return {
    steps,
    derivable,
    loading,
    error,
    writeError,
    create,
    addDerivable,
    update,
    move,
    remove,
    reload: load,
  };
}
