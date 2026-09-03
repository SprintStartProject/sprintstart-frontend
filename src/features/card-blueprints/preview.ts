import { BOARD_STAGES, type BoardStage } from "../board/layout/boardStructure";
import type { CardBlueprint } from "./types";

/** One card the hire would get, with anything chained behind it. */
export type PreviewEntry = {
  blueprint: CardBlueprint;
  /** The cards that wait on it, in working order. Empty for an ordinary card. */
  behind: CardBlueprint[];
  /** What this card waits on when that card is in another stage, so no pile can form. */
  waitsOn: CardBlueprint | null;
};

/** One stage of the preview board. */
export type PreviewBand = { stage: BoardStage; entries: PreviewEntry[] };

/**
 * What a set of blueprints becomes on a hire's board.
 *
 * A page that lets somebody write rules should show what the rules produce, and "what does a new
 * backend hire actually get" is the only question a PM has about a list of blueprints. Answering it
 * by hiring somebody is a slow feedback loop; answering it with a flat numbered list — which is
 * what this was — answers a different question, because the board the hire opens is not a list. It
 * has stages that fold, and chains that stand as one card with the rest behind it.
 *
 * So this reproduces the two rules the board itself applies, deliberately and in the same shape:
 *
 * - **Stages are bands.** A card is filed under the stage its blueprint names.
 * - **A chain is a pile, and a pile lives in one band.** A run of "comes after" collects into one
 *   entry as long as it stays in the same stage and nobody forks it — the same conditions
 *   `buildStacks` applies on the board, for the same reason: a fork is not a sequence, and a pile
 *   is drawn in one place. A link that crosses a stage stays a link and is named as one, which is
 *   also what the hire will see — a card that waits, and says what for.
 *
 * Ordered by the PM's own ordering within each band, which is the order the cards are created in.
 */
export function previewBands(blueprints: CardBlueprint[]): PreviewBand[] {
  const byId = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const stageOf = (blueprint: CardBlueprint) => blueprint.stage;

  const successors = new Map<string, CardBlueprint[]>();
  for (const blueprint of blueprints) {
    const after = blueprint.afterId ? byId.get(blueprint.afterId) : undefined;
    if (!after) continue;
    successors.set(after.id, [...(successors.get(after.id) ?? []), blueprint]);
  }

  /** Whether one card may stand directly behind another: same stage, and nothing else waiting. */
  const continues = (blueprint: CardBlueprint, after: CardBlueprint) =>
    stageOf(blueprint) === stageOf(after) && (successors.get(after.id) ?? []).length === 1;

  const claimed = new Set<string>();
  const bands: PreviewBand[] = [];

  for (const stage of BOARD_STAGES) {
    const entries: PreviewEntry[] = [];

    for (const blueprint of blueprints) {
      if (blueprint.stage !== stage || claimed.has(blueprint.id)) continue;

      const after = blueprint.afterId ? byId.get(blueprint.afterId) : undefined;
      if (after && continues(blueprint, after)) continue;

      const behind: CardBlueprint[] = [];
      let last = blueprint;
      for (;;) {
        const next = (successors.get(last.id) ?? [])[0];
        if (!next || !continues(next, last)) break;
        behind.push(next);
        claimed.add(next.id);
        last = next;
      }

      claimed.add(blueprint.id);
      entries.push({ blueprint, behind, waitsOn: after && !behind.includes(after) ? after : null });
    }

    if (entries.length > 0) bands.push({ stage, entries });
  }

  return bands;
}
