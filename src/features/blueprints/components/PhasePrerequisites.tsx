import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { DropdownSelect } from "../../../components/ui/DropdownSelect.tsx";
import { canConnect } from "../../graph-diagram/graphLayout.ts";
import { LOCK_SENTENCE } from "../../graph-diagram/lockWords.ts";
import type { BlueprintPhase } from "../types.ts";

/**
 * The resting state of both pickers: nothing chosen, and the control saying what choosing one
 * would do rather than showing a blank.
 *
 * These are the house dropdown rather than a native `<select>`, which is what the rest of this
 * page's controls are. A native list is the OS's, not the product's — it arrives in a different
 * typeface with different corners, and next to the chips it sits under it read as two kits.
 */
const ADD_ONE = { value: "", label: "Add one…" };

const asOption = (phase: BlueprintPhase) => ({ value: phase.id, label: phase.title });

/**
 * What a phase waits for, and what waits on it — the graph's one relation, in words.
 *
 * Both directions, because they are one fact read from two ends and a surface that shows only the
 * first answers half of what somebody wants to know about a phase. "What has to happen before
 * this" decides whether it can be moved; "what opens when this is done" decides whether it is
 * worth doing early, and it is the number the graph makes obvious and a list does not.
 *
 * Editable in both directions too. An arrow belongs to the phase it points at, so adding one on
 * the "opens up" side sets it on *that* phase — which is the same edge, drawn from the other end,
 * and is what somebody working down a list expects when they have this phase in front of them and
 * the next one in mind.
 */
export function PhasePrerequisites({
  phase,
  phases,
  editable,
  onAdd,
  onRemove,
}: {
  phase: BlueprintPhase;
  phases: BlueprintPhase[];
  editable: boolean;
  /** Makes `blocked` wait for `blockerId`. */
  onAdd: (blocked: BlueprintPhase, blockerId: string) => Promise<void>;
  onRemove: (blocked: BlueprintPhase, blockerId: string) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const byId = useMemo(() => new Map(phases.map((item) => [item.id, item])), [phases]);

  const blockers = phase.blockerIds
    .map((id) => byId.get(id))
    .filter((item): item is BlueprintPhase => item !== undefined);
  const dependents = useMemo(
    () => phases.filter((other) => other.blockerIds.includes(phase.id)),
    [phase.id, phases],
  );

  const canWaitFor = useMemo(
    () => phases.filter((other) => canConnect(phases, phase.id, other.id)),
    [phase.id, phases],
  );
  const canOpen = useMemo(
    () => phases.filter((other) => canConnect(phases, other.id, phase.id)),
    [phase.id, phases],
  );

  async function run(work: () => Promise<void>) {
    setIsSaving(true);
    try {
      await work();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="font-semibold text-app-text">Waits for</h3>
        <p className="text-xs text-app-text-muted">{LOCK_SENTENCE}</p>

        {blockers.length === 0 ? (
          <p className="text-sm text-app-text-muted">
            Nothing — this phase is a place a hire can start.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {blockers.map((blocker) => (
              <li key={blocker.id}>
                <Badge variant="brand" size="sm" className="gap-1">
                  {blocker.title}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={`Stop waiting for ${blocker.title}`}
                      disabled={isSaving}
                      onClick={() => void run(() => onRemove(phase, blocker.id))}
                      className="rounded-full transition-colors hover:text-app-danger-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {editable && canWaitFor.length > 0 ? (
          <div className="max-w-64">
            <DropdownSelect
              label={`Add something ${phase.title} waits for`}
              value=""
              disabled={isSaving}
              options={[ADD_ONE, ...canWaitFor.map(asOption)]}
              onChange={(blockerId) => {
                if (blockerId) void run(() => onAdd(phase, blockerId));
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-app-text">Opens up</h3>
        <p className="text-xs text-app-text-muted">
          These stay closed until this phase is finished.
        </p>

        {dependents.length === 0 ? (
          <p className="text-sm text-app-text-muted">
            Nothing waits on this one, so leaving it for later holds nobody up.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {dependents.map((dependent) => (
              <li key={dependent.id}>
                <Badge variant="neutral" size="sm" className="gap-1">
                  {dependent.title}
                  {editable ? (
                    <button
                      type="button"
                      aria-label={`Stop ${dependent.title} waiting for ${phase.title}`}
                      disabled={isSaving}
                      onClick={() => void run(() => onRemove(dependent, phase.id))}
                      className="rounded-full transition-colors hover:text-app-danger-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {editable && canOpen.length > 0 ? (
          <div className="max-w-64">
            <DropdownSelect
              label={`Add something ${phase.title} opens up`}
              value=""
              disabled={isSaving}
              options={[ADD_ONE, ...canOpen.map(asOption)]}
              onChange={(blockedId) => {
                const blocked = byId.get(blockedId);
                if (blocked) void run(() => onAdd(blocked, phase.id));
              }}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
