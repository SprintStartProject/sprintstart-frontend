import type { BlueprintLifecycle } from "../pathLifecycle.ts";

/** How many versions back the rail draws before it stops naming them one by one. */
const RAIL_LIMIT = 6;

/**
 * A blueprint's versions as a line, with the one in service marked and the draft ahead of it.
 *
 * Version was a number in the corner of a badge — "v4" — which says how many times this has been
 * republished and nothing about where the blueprint stands. The two facts a PM has about a
 * blueprint are *what hires are getting* and *what is being written*, and they used to be a status
 * chip and a sentence in different parts of the card, in a group heading that contradicted both.
 *
 * Here they are one picture: earlier versions behind, the live one filled, and the draft as a
 * hollow ring one step ahead — not yet real, and plainly not what anybody has. A blueprint with no
 * draft simply ends at the filled dot, which is the shape of "nothing is pending".
 *
 * Long histories are not drawn dot by dot. Past half a dozen, the count is the fact and the
 * individual versions are not — nobody reads the eleventh dot as the eleventh.
 */
export function BlueprintVersionRail({ lifecycle }: { lifecycle: BlueprintLifecycle }) {
  const newest = lifecycle.draft ?? lifecycle.inService ?? 0;
  const earlier = Math.max(0, (lifecycle.inService ?? newest) - 1);
  const shown = Math.min(earlier, RAIL_LIMIT);
  const hidden = earlier - shown;

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-app-text-muted">
      {hidden > 0 ? <span className="tabular-nums">+{hidden} earlier</span> : null}

      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-border-strong"
        />
      ))}

      {lifecycle.inService !== null ? (
        <>
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-app-brand" />
          <span className="font-medium text-app-text tabular-nums">
            v{lifecycle.inService} in service
          </span>
        </>
      ) : null}

      {lifecycle.draft !== null ? (
        <>
          {/* The arrow says "and after that" — with nothing in service there is no "that", and a
              leading arrow points at the edge of the card. */}
          {lifecycle.inService !== null ? (
            <span aria-hidden="true" className="text-app-text-subtle">
              →
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-app-warning-solid"
          />
          <span className="font-medium text-app-warning-text tabular-nums">
            v{lifecycle.draft} being written
          </span>
        </>
      ) : null}

      {lifecycle.retired ? <span>Retired at v{newest}</span> : null}
    </p>
  );
}
