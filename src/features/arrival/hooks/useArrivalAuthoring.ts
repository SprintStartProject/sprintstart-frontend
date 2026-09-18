import { useCallback, useEffect, useState } from "react";
import { arrivalService } from "../../../services/arrivalService";
import type {
  ArrivalScope,
  ArrivalStep,
  CreateArrivalStepRequest,
  DerivableArrivalStep,
  UpdateArrivalStepRequest,
} from "../types";

/**
 * The company-wide and (when there is one) project arrival lists, loaded together for the people
 * who author them.
 *
 * Loaded together rather than one scope at a time: authoring shows both blocks on one screen now —
 * a project step that reuses a company key overrides it in place, and rendering that requires
 * seeing both lists at once rather than remounting when a tab changes.
 *
 * Every write names its scope explicitly (`"company"` or `"project"`) rather than trusting which
 * list happened to be on screen — the company-wide block stays visible even while a project is
 * selected, so "the scope currently shown" is not one answer.
 *
 * The derivable catalog is loaded with the lists rather than separately, because its `added` flags
 * describe the company-wide list and the two going out of step would offer to add something twice.
 * A derivation is code bound to one key, so it can only ever land on that one list — `addDerivable`
 * below does not take a scope.
 */
export function useArrivalAuthoring(projectId: string | null = null) {
  const [company, setCompany] = useState<ArrivalStep[] | null>(null);
  const [project, setProject] = useState<ArrivalStep[] | null>(null);
  const [derivable, setDerivable] = useState<DerivableArrivalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const load = useCallback(
    async (options?: { silently?: boolean }) => {
      // A reload after a write happens underneath a list that is already on screen -- swapping it
      // for the spinner and back would blink the whole thing away for what is otherwise a quiet
      // background refetch. Only the very first load, with nothing on screen yet, blocks on it.
      if (!options?.silently) setLoading(true);
      setError(false);
      try {
        // Settled separately: the company-wide list is the one block that always renders, and a
        // project list or catalog that will not load must not take it down too.
        const [companyResult, projectResult, catalog] = await Promise.allSettled([
          arrivalService.listSteps(null),
          projectId ? arrivalService.listSteps(projectId) : Promise.resolve<ArrivalStep[]>([]),
          arrivalService.listDerivableSteps(),
        ]);

        if (companyResult.status === "rejected") throw companyResult.reason;
        setCompany(companyResult.value);
        setProject(projectResult.status === "fulfilled" ? projectResult.value : []);
        setDerivable(catalog.status === "fulfilled" ? catalog.value : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

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
        await load({ silently: true });
        return true;
      } catch {
        setWriteError(failureMessage);
        return false;
      }
    },
    [load],
  );

  /** Company-wide is the absence of a project, on the wire as much as in the model. */
  const scopeProjectId = useCallback(
    (scope: ArrivalScope) => (scope === "project" ? projectId : null),
    [projectId],
  );

  const listFor = useCallback(
    (scope: ArrivalScope) => (scope === "company" ? company : project),
    [company, project],
  );

  const create = useCallback(
    async (request: CreateArrivalStepRequest, scope: ArrivalScope) =>
      await write(
        async () =>
          await arrivalService.createStep({ ...request, projectId: scopeProjectId(scope) }),
        "That step could not be added. A step with that key may already exist.",
      ),
    [write, scopeProjectId],
  );

  /**
   * Adds a step the system can check for itself, using its suggested wording.
   *
   * Always company-wide: the backend binds a known key to its derivation, so the same catalog
   * entry cannot be re-derived a second time into a project's own list. Nothing about *how* it is
   * settled is sent either — the backend overrides `settledBy` and `selfConfirmable` whatever a
   * caller asks for, so the wording is only a starting point, editable afterwards like any step.
   */
  const addDerivable = useCallback(
    async (derivation: DerivableArrivalStep) =>
      await write(
        async () =>
          await arrivalService.createStep({
            key: derivation.key,
            projectId: null,
            title: derivation.suggestedTitle,
            description: derivation.suggestedDescription,
          }),
        "That step could not be added. It may already be on the list.",
      ),
    [write],
  );

  const update = useCallback(
    async (key: string, request: UpdateArrivalStepRequest, scope: ArrivalScope) =>
      await write(
        async () => await arrivalService.updateStep(key, request, scopeProjectId(scope)),
        "That change could not be saved.",
      ),
    [write, scopeProjectId],
  );

  /**
   * Moves one step within its own scope, and sends that scope's whole resulting order.
   *
   * Never a from/to pair: two people reordering at once cannot then interleave into an order
   * neither of them chose.
   */
  const move = useCallback(
    async (key: string, direction: "up" | "down", scope: ArrivalScope) => {
      const list = listFor(scope);
      if (!list) return false;
      const index = list.findIndex((step) => step.key === key);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || target < 0 || target >= list.length) return false;

      const reordered = [...list];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

      return await write(
        async () =>
          await arrivalService.reorderSteps(
            reordered.map((step) => step.key),
            scopeProjectId(scope),
          ),
        "That order could not be saved.",
      );
    },
    [listFor, write, scopeProjectId],
  );

  /** Applies a whole ordering at once, e.g. after a drag — see `move` for why never a pair. */
  const reorder = useCallback(
    async (orderedKeys: string[], scope: ArrivalScope) =>
      await write(
        async () => await arrivalService.reorderSteps(orderedKeys, scopeProjectId(scope)),
        "That order could not be saved.",
      ),
    [write, scopeProjectId],
  );

  const remove = useCallback(
    async (key: string, scope: ArrivalScope) =>
      await write(
        async () => await arrivalService.deleteStep(key, scopeProjectId(scope)),
        "That step could not be removed.",
      ),
    [write, scopeProjectId],
  );

  return {
    company,
    project,
    derivable,
    loading,
    error,
    writeError,
    create,
    addDerivable,
    update,
    move,
    reorder,
    remove,
    reload: load,
  };
}
