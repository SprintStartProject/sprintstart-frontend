import { useMemo } from "react";
import type { DragControls } from "framer-motion";
import { cardAccent } from "../layout/cardAccents";
import type { CardSize } from "../layout/cardSizes";
import type { CardState } from "../layout/boardStructure";
import type { CardStack } from "../layout/cardStacks";
import type { BoardCard } from "../types";
import type { BoardCardControls } from "./boardCardControls";
import { DragHandle, PilePicker, ResizeHandle } from "./CardHandles";

export type CardControlsInput = {
  card: BoardCard;
  index: number;
  total: number;
  label: string;
  isArranging: boolean;
  collapsed: boolean;
  pinned: boolean;
  state?: CardState;
  leadsPile: boolean;
  allCards: BoardCard[];
  stack?: CardStack;
  size: CardSize;
  dragControls: DragControls;
  onStackOnto?: (cardId: string, targetId: string | null) => void;
  onToggleStack?: (rootId: string) => void;
  onResize?: (size: CardSize) => void;
  onToggleCollapsed?: (cardId: string) => void;
  onTogglePinned?: (cardId: string) => void;
  onMove?: (cardId: string, direction: "up" | "down") => void;
};

function stackChip(
  cardId: string,
  stack: CardStack | undefined,
  onToggleStack: ((rootId: string) => void) | undefined,
): BoardCardControls["stack"] {
  if (!stack || !onToggleStack) return undefined;

  return {
    position: stack.memberIds.indexOf(cardId) + 1,
    total: stack.memberIds.length,
    remaining: stack.remaining,
    onToggle: () => onToggleStack(stack.rootId),
  };
}

function controlsFor(input: CardControlsInput): BoardCardControls {
  const { card, index, total, label, isArranging, collapsed, pinned, state, leadsPile } = input;
  const { allCards, stack, size, dragControls } = input;
  const { onStackOnto, onToggleStack, onResize, onToggleCollapsed, onTogglePinned, onMove } = input;

  return {
    collapsed,
    pinned,
    accent: cardAccent(card.content.kind),
    state,
    // The pile this card lies in. Only while the board is being planned — see where it is passed.
    pilePicker: onStackOnto ? (
      <PilePicker
        card={card}
        label={label}
        predecessorId={state?.predecessorId ?? null}
        leadsPile={leadsPile}
        allCards={allCards}
        onStackOnto={onStackOnto}
      />
    ) : undefined,
    stack: stackChip(card.id, stack, onToggleStack),
    size,
    resizeHandle:
      onResize && !isArranging ? (
        <ResizeHandle label={label} size={size} onResize={onResize} />
      ) : undefined,
    onToggleCollapsed: onToggleCollapsed ? () => onToggleCollapsed(card.id) : undefined,
    onTogglePinned: onTogglePinned ? () => onTogglePinned(card.id) : undefined,
    dragHandle: onMove ? (
      <DragHandle
        cardId={card.id}
        label={label}
        index={index}
        total={total}
        dragControls={dragControls}
        onMove={onMove}
      />
    ) : undefined,
  };
}

/** What the board offers this card's frame: fold, pin, pile, resize and the drag grip. */
export function useCardControls(input: CardControlsInput): BoardCardControls {
  const { card, index, total, label, isArranging, collapsed, pinned, state, leadsPile } = input;
  const { allCards, stack, size, dragControls } = input;
  const { onStackOnto, onToggleStack, onResize, onToggleCollapsed, onTogglePinned, onMove } = input;

  return useMemo(
    () =>
      controlsFor({
        card,
        index,
        total,
        label,
        isArranging,
        collapsed,
        pinned,
        state,
        leadsPile,
        allCards,
        stack,
        size,
        dragControls,
        onStackOnto,
        onToggleStack,
        onResize,
        onToggleCollapsed,
        onTogglePinned,
        onMove,
      }),
    [
      allCards,
      card,
      collapsed,
      dragControls,
      index,
      isArranging,
      label,
      leadsPile,
      onMove,
      onResize,
      onStackOnto,
      onToggleCollapsed,
      onTogglePinned,
      onToggleStack,
      pinned,
      size,
      stack,
      state,
      total,
    ],
  );
}
