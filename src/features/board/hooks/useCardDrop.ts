import { useCallback } from "react";
import { contains, toViewport } from "../layout/dragGeometry";
import { groupOf, type BoardGroup } from "../layout/boardGroups";
import type { CardStack } from "../layout/cardStacks";

type Point = { x: number; y: number };

type CardDropInput = {
  groups: BoardGroup[];
  stacks: Map<string, CardStack> | undefined;
  expandedStackIds: ReadonlySet<string> | undefined;
  onStackOnto:
    ((cardId: string, targetId: string | null, carry?: readonly string[]) => void) | undefined;
  onAssignGroup: ((cardId: string, groupId: string | null) => void) | undefined;
  areaEntries: () => [string, HTMLElement][];
  /** The card lit as the pile target when the drop happens. */
  litTarget: () => string | null;
  /** Puts the lit target and the pending wait away. */
  settle: () => void;
};

/** What letting go of a card does: pile it, take it out of a pile, or put it in an area. */
export function useCardDrop(input: CardDropInput) {
  const { groups, stacks, expandedStackIds, onStackOnto, onAssignGroup } = input;
  const { areaEntries, litTarget, settle } = input;

  const pileOnto = useCallback(
    (cardId: string, target: string) => {
      // A closed pile is drawn as one card and moves as one: all of it goes onto the target. From
      // an open pile only the card that was picked up goes.
      const own = stacks?.get(cardId);
      if (own && !expandedStackIds?.has(own.rootId)) {
        onStackOnto?.(own.memberIds[0], target, own.memberIds);
      } else {
        onStackOnto?.(cardId, target);
      }
    },
    [expandedStackIds, onStackOnto, stacks],
  );

  /** Dragged out of an open pile and let go anywhere outside it: it leaves the pile. */
  const leaveOpenPile = useCallback(
    (cardId: string, at: Point) => {
      const own = stacks?.get(cardId);
      if (!own || !onStackOnto || !expandedStackIds?.has(own.rootId)) return;

      const frame = document.querySelector(`[data-stack-root="${CSS.escape(own.rootId)}"]`);
      if (frame instanceof HTMLElement && !contains(frame, at.x, at.y)) onStackOnto(cardId, null);
    },
    [expandedStackIds, onStackOnto, stacks],
  );

  /**
   * Where a card was let go decides which area it is in.
   *
   * Dropped inside an area's box, it joins that area; dropped anywhere else, it leaves the one it
   * was in. Decided on release rather than during the drag, so the board is not re-grouping under
   * a pointer that is still moving — and it is the pointer's own position that counts, not the
   * card's, because that is where the hire is looking when they let go.
   */
  const assignByPosition = useCallback(
    (cardId: string, at: Point) => {
      for (const [groupId, element] of areaEntries()) {
        if (contains(element, at.x, at.y)) {
          if (groupOf(groups, cardId)?.id !== groupId) onAssignGroup?.(cardId, groupId);

          return;
        }
      }

      if (groupOf(groups, cardId)) onAssignGroup?.(cardId, null);
    },
    [areaEntries, groups, onAssignGroup],
  );

  return useCallback(
    (cardId: string, point: Point) => {
      const target = litTarget();
      settle();

      // Let go over the middle of another card: the two become a pile.
      if (target && target !== cardId && onStackOnto) {
        pileOnto(cardId, target);
        return;
      }

      const at = toViewport(point);
      leaveOpenPile(cardId, at);
      if (onAssignGroup) assignByPosition(cardId, at);
    },
    [assignByPosition, leaveOpenPile, litTarget, onAssignGroup, onStackOnto, pileOnto, settle],
  );
}
