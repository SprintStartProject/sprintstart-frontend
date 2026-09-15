import { useState } from "react";
import { ApiError } from "../../../services/apiClient";
import { boardService } from "../../../services/boardService";
import { onboardingService } from "../../../services/onboardingService";
import { cardBlueprintService } from "../../card-blueprints/cardBlueprintService";
import { blueprintsForRoles } from "../../card-blueprints/types";
import {
  markTitle,
  planCardsFromPath,
  titleKey,
  type PlannedArea,
} from "../generation/pathToCards";
import { type BoardStage, type DependencySource } from "../layout/boardStructure";

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
  /** The areas to create, in order. An area is a *place*; when a card is due is a separate answer. */
  areas: { name: string; cardIds: string[] }[];
  /** Card id to the stage it belongs in. */
  stages: Record<string, BoardStage>;
  /** Card id to the id of the card that must be finished first. */
  /** Each chained card's predecessor, and who is claiming the link. */
  chain: Record<string, { id: string; source: DependencySource }>;
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
   * @param existingTitles Checklist titles already on the board, exactly as they are stored — the
   *   run compares them itself, by {@link titleKey}, so a caller never has to know how a title is
   *   marked or how the server trimmed it.
   */
  generate: (
    projectId: string,
    roleIds: readonly string[],
    existingTitles: Iterable<string>,
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
 *
 * **Already-there is judged by {@link titleKey}, not by the stored string.** The comparison is the
 * only thing standing between a hire and two of every card, and an exact match is too brittle to be
 * it: the server trims what it stores, a PM's blueprint title may have been typed with a trailing
 * space, and the path and the blueprints can name the same work under different markers. Every one
 * of those reads as "no card by that name" and writes a second copy — which is what a hire sees as
 * their old card and a new one saying the same thing. Nothing about that is helped by the areas
 * they are filed in, so a hire who has since dissolved an area sees the two copies side by side.
 */
export function useGeneratedPathCards(): UseGeneratedPathCardsResult {
  const [generating, setGenerating] = useState(false);

  async function generate(
    projectId: string,
    roleIds: readonly string[],
    existingTitles: Iterable<string>,
  ): Promise<GenerationResult | GenerationRefusal> {
    setGenerating(true);
    try {
      // Grows as the run goes: two blueprints named the same thing are the same card as surely as
      // one blueprint and a card already on the board, and only one of them should be written.
      const present = new Set([...existingTitles].map(titleKey));
      const plan = [...(await blueprintAreas(projectId, roleIds)), ...(await pathAreas())];
      if (plan.length === 0) return "NOTHING_TO_BUILD";

      const areas: GenerationResult["areas"] = [];
      const stages: Record<string, BoardStage> = {};
      const chain: GenerationResult["chain"] = {};
      // Kept across every area rather than per area, because a blueprint may say it comes after one
      // in a different stage — and a chain that silently dropped at an area boundary would look
      // exactly like the PM never having set it.
      const mintedByKey = new Map<string, string>();
      let created = 0;

      for (const area of plan) {
        const cardIds: string[] = [];

        for (const plannedCard of area.cards) {
          // Only a titled checklist can be recognised again; anything else is written as planned.
          const key =
            plannedCard.request.kind === "CHECKLIST"
              ? titleKey(plannedCard.request.title ?? null)
              : "";
          if (key !== "") {
            if (present.has(key)) continue;
            present.add(key);
          }

          const card = await boardService.addCard(projectId, plannedCard.request);
          mintedByKey.set(plannedCard.key, card.id);
          cardIds.push(card.id);
          stages[card.id] = plannedCard.stage;
          created += 1;

          // A predecessor that was skipped as already-present has no minted id, so this card simply
          // waits on nothing rather than on a card that was never created.
          const afterId = plannedCard.afterKey ? mintedByKey.get(plannedCard.afterKey) : undefined;
          if (afterId) chain[card.id] = { id: afterId, source: area.source };
        }

        if (cardIds.length > 0) areas.push({ name: area.name, cardIds });
      }

      if (created === 0) return "NOTHING_NEW";

      return { cardCount: created, areas, stages, chain };
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
 * The project's card blueprints for this hire's roles, as one area of cards.
 *
 * **One area, whatever stages the blueprints span.** This used to be one area per stage, because a
 * plan's stage lived on the area — which meant a team that had sequenced its cards across the
 * stages arrived as several areas called "From your team — Now", "— Later" and so on, one tab stop
 * each in the board's table of contents for one set of cards somebody wrote in one sitting. The
 * stage is on the card now (see {@link PlannedArea}), so what the team prescribed is one place on
 * the board and the stages fold inside it like they do everywhere else.
 *
 * Ordered by the PM's own ordering rather than by stage: `blueprintsForRoles` sorts by position,
 * which is the order the editor's list is in and the order the cards are created in.
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

  return [
    {
      name: "From your team",
      source: "TEAM",
      cards: blueprints.map((blueprint) => ({
        key: blueprint.id,
        request: {
          kind: "CHECKLIST" as const,
          title: markTitle("TEAM", blueprint.title),
          items: blueprint.items.map((text) => ({ text, done: false })),
        },
        stage: blueprint.stage,
        afterKey: blueprint.afterId,
      })),
    },
  ];
}
