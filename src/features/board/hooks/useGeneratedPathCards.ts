import { useState } from "react";
import { ApiError } from "../../../services/apiClient";
import { boardService } from "../../../services/boardService";
import { onboardingService } from "../../../services/onboardingService";
import { cardBlueprintService } from "../../card-blueprints/cardBlueprintService";
import { blueprintsForRoles } from "../../card-blueprints/types";
import { markTitle, planCardsFromPath, type PlannedArea } from "../generation/pathToCards";
import { BOARD_STAGES, STAGE_LABELS, type BoardStage } from "../layout/boardStructure";

/** Why a generation run produced nothing, in words a page can put in a toast. */
export type GenerationRefusal =
  /** Nothing to build from: no personalised path, and no blueprints for this hire's roles. */
  | "NOTHING_TO_BUILD"
  /** Everything that could be built is already a card, or already finished. */
  | "NOTHING_NEW"
  /** A card could not be written. */
  | "FAILED";

/** What a successful run put on the board, for the page to file into areas and stages. */
export type GenerationResult = {
  cardCount: number;
  areas: { name: string; stage: BoardStage; cardIds: string[] }[];
  /** Card id to the id of the card that must be finished first. */
  chain: Record<string, string>;
};

type UseGeneratedPathCardsResult = {
  /**
   * Builds this hire's onboarding into cards on their board.
   *
   * Resolves with what was created, or with the reason nothing was. Never throws: a page that has
   * to try/catch around a button is a page that will forget to.
   *
   * @param projectId The project whose board is being filled.
   * @param roleIds The hire's roles on that project, which decide the blueprints that apply.
   * @param existingTitles Checklist titles already on the board, so a second run adds nothing twice.
   */
  generate: (
    projectId: string,
    roleIds: readonly string[],
    existingTitles: Set<string>,
  ) => Promise<GenerationResult | GenerationRefusal>;
  generating: boolean;
};

/**
 * Fills the hire's board from the two things that know what they should be doing.
 *
 * **The team's blueprints**, which a PM wrote once for everybody of a given role, and **the
 * personalised path**, which the AI service drafts for this hire from the project's own corpus.
 * Both existed already and neither reached the board: blueprints had no consumer, and the path
 * lived on a page a hire visited once and never worked from. A checklist they tick on the surface
 * they already use is the same plan, in the place it gets used.
 *
 * Blueprints come first. A blueprint is what a person decided every hire of this role needs; the
 * path is what the corpus suggests. When the two disagree about what comes first, the person wins.
 *
 * **Created one at a time, in order.** The board's own order is creation order, so posting in the
 * order the plan puts them in means the board reads as the plan reads before anybody arranges
 * anything. It is a handful of small writes rather than one batch because there is no batch
 * endpoint; the loop stops at the first failure and reports what it managed, so a hire whose
 * network dropped halfway gets the cards that landed rather than a board in an unknown state.
 *
 * A card whose title is already on the board is skipped, which is what makes running this twice
 * safe — a hire who generates, dismisses two cards and generates again gets those two back and
 * nothing else duplicated.
 */
export function useGeneratedPathCards(): UseGeneratedPathCardsResult {
  const [generating, setGenerating] = useState(false);

  async function generate(
    projectId: string,
    roleIds: readonly string[],
    existingTitles: Set<string>,
  ): Promise<GenerationResult | GenerationRefusal> {
    setGenerating(true);
    try {
      const plan = [...(await blueprintAreas(projectId, roleIds)), ...(await pathAreas())];
      if (plan.length === 0) return "NOTHING_TO_BUILD";

      const areas: GenerationResult["areas"] = [];
      const chain: Record<string, string> = {};
      // Kept across every area rather than per area, because a blueprint may say it comes after one
      // in a different stage — and a chain that silently dropped at an area boundary would look
      // exactly like the PM never having set it.
      const mintedByKey = new Map<string, string>();
      let created = 0;

      for (const area of plan) {
        const cardIds: string[] = [];

        for (const plannedCard of area.cards) {
          const title =
            plannedCard.request.kind === "CHECKLIST" ? (plannedCard.request.title ?? "") : "";
          if (existingTitles.has(title)) continue;

          const card = await boardService.addCard(projectId, plannedCard.request);
          mintedByKey.set(plannedCard.key, card.id);
          cardIds.push(card.id);
          created += 1;

          // A predecessor that was skipped as already-present has no minted id, so this card simply
          // waits on nothing rather than on a card that was never created.
          const afterId = plannedCard.afterKey ? mintedByKey.get(plannedCard.afterKey) : undefined;
          if (afterId) chain[card.id] = afterId;
        }

        if (cardIds.length > 0) areas.push({ name: area.name, stage: area.stage, cardIds });
      }

      if (created === 0) return "NOTHING_NEW";

      return { cardCount: created, areas, chain };
    } catch {
      return "FAILED";
    } finally {
      setGenerating(false);
    }
  }

  return { generate, generating };
}

/**
 * The hire's personalised path as areas of cards, or none when they have no path yet.
 *
 * A missing path is an ordinary state — a hire who has never generated one on the onboarding page
 * simply has none — so the 404 is absorbed here rather than failing the whole run. Blueprints can
 * still fill a board on their own, and often should: they are the half that does not need the hire
 * to have done anything first.
 */
async function pathAreas(): Promise<PlannedArea[]> {
  try {
    return planCardsFromPath(await onboardingService.fetchPath()).areas;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

/**
 * The project's card blueprints for this hire's roles, as areas of cards.
 *
 * One area per stage, because `applyPlan` writes an area's stage onto every card in it — a single
 * area of mixed stages would flatten a PM's sequencing into whichever stage happened to be first.
 * Named plainly when there is only one, and by stage when there are several, so the rail never
 * shows three rows with the same name.
 *
 * A project with no blueprints yields nothing, which is the ordinary state on an installation where
 * nobody has written any — not an error, and not an empty area.
 */
async function blueprintAreas(
  projectId: string,
  roleIds: readonly string[],
): Promise<PlannedArea[]> {
  const blueprints = blueprintsForRoles(await cardBlueprintService.list(projectId), roleIds);
  if (blueprints.length === 0) return [];

  const stages = BOARD_STAGES.filter((stage) =>
    blueprints.some((blueprint) => blueprint.stage === stage),
  );

  return stages.map((stage) => ({
    name: stages.length === 1 ? "From your team" : `From your team — ${STAGE_LABELS[stage].title}`,
    stage,
    cards: blueprints
      .filter((blueprint) => blueprint.stage === stage)
      .map((blueprint) => ({
        key: blueprint.id,
        request: {
          kind: "CHECKLIST" as const,
          title: markTitle("TEAM", blueprint.title),
          items: blueprint.items.map((text) => ({ text, done: false })),
        },
        afterKey: blueprint.afterId,
      })),
  }));
}
