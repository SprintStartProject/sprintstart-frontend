import type { BoardStage } from "../board/layout/boardStructure";

/**
 * A card a PM wants every new hire of some role to start with.
 *
 * The board fills itself from two directions. What the *system* knows goes on it automatically —
 * the path, the arrival steps, the open work — and what the *buddy* judges worth keeping is placed
 * in conversation. Neither covers what the team knows: that a backend hire needs the on-call rota
 * explained in week one, that everybody reads the incident write-up before touching deploys. That
 * lives in a PM's head, gets said once per hire, and is the first thing forgotten in a busy month.
 *
 * A blueprint is that knowledge written down once. It says what the card is called, what is on it,
 * when it is due, which roles it applies to, and what has to be finished before it. A hire's board
 * is then seeded from the blueprints their roles match — the same list every time, without anybody
 * having to remember it.
 *
 * Deliberately *not* the same thing as the AI service's onboarding blueprints, which describe the
 * phases and steps of a generated path. Those are drafted from the project's corpus and regenerated
 * as it moves; these are written by a person and change only when that person changes them. The
 * names collide because both are templates; nothing else about them does.
 */
export type CardBlueprint = {
  id: string;
  /** What the card will be called on the hire's board. */
  title: string;
  /** One line under the title, saying why this card is here. Optional and often worth it. */
  description: string;
  /** The lines on the checklist, in order. A blueprint with no lines is a card with a title only. */
  items: string[];
  /** When it is due — the same three stages the board sorts and hides by. */
  stage: BoardStage;
  /**
   * Which project roles get this card. Empty means everybody on the project.
   *
   * Ids rather than names: a role renamed from "Backend Dev" to "Platform Engineer" should keep its
   * blueprints, and matching on the name is how a rename silently empties somebody's board.
   */
  roleIds: string[];
  /** Where it sits among the blueprints, which is the order the cards are created in. */
  position: number;
  /**
   * The blueprint that has to be finished before this one, or null.
   *
   * Becomes a real dependency on the hire's board: their card waits on the card the other blueprint
   * produced. This is where "read the runbook before you deploy" stops being something a PM says
   * and starts being something the board holds.
   */
  afterId: string | null;
};

/** A blueprint as it is written, before it has an id or a position. */
export type CardBlueprintDraft = Omit<CardBlueprint, "id" | "position">;

/** An empty draft, so the editor opens on something rather than on nulls. */
export const EMPTY_DRAFT: CardBlueprintDraft = {
  title: "",
  description: "",
  items: [],
  stage: "NOW",
  roleIds: [],
  afterId: null,
};

/**
 * The blueprints that apply to a hire holding these roles, in order.
 *
 * A blueprint with no roles applies to everyone: "read the incident write-up" is not a backend
 * thing, and forcing a PM to tick every role to say so would mean forgetting one whenever a role is
 * added later.
 */
export function blueprintsForRoles(
  blueprints: CardBlueprint[],
  roleIds: readonly string[],
): CardBlueprint[] {
  return [...blueprints]
    .filter(
      (blueprint) =>
        blueprint.roleIds.length === 0 ||
        blueprint.roleIds.some((roleId) => roleIds.includes(roleId)),
    )
    .sort((a, b) => a.position - b.position);
}
