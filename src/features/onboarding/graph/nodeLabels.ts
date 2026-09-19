// ============================================================
// features/onboarding/graph/nodeLabels.ts
// ============================================================
// Sizes and words shared by the graph cards and the lists, kept
// apart from the card components so those files export only
// components (fast refresh).
// ============================================================

import type { ItemState, PhaseItem, PhaseState } from "../journey";

export const ITEM_NODE_SIZE = { width: 248, height: 92 };
export const PHASE_NODE_SIZE = { width: 280, height: 190 };

export const itemStateLabel: Record<ItemState, string> = {
  done: "Done",
  skipped: "Skipped",
  active: "In progress",
  open: "Ready",
  retry: "Try again",
  locked: "Locked",
};

export function itemKindLabel(item: PhaseItem): string {
  if (item.kind === "question") {
    return item.question.type === "MULTIPLE_CHOICE" ? "Multiple choice" : "Short answer";
  }
  switch (item.step.type) {
    case "VIDEO":
      return "Video";
    case "DOCUMENT":
      return "Reading";
    case "LINK":
      return "Link";
    default:
      return "Task";
  }
}

export const phaseStateLabel: Record<PhaseState, string> = {
  done: "Complete",
  active: "In progress",
  open: "Ready to start",
  locked: "Locked",
};

/** What the primary button of an item says, or null for items that only open read-only. */
export function primaryActionLabel(item: PhaseItem, state: ItemState): string | null {
  if (item.kind === "question") {
    if (state === "retry") return "Try again";
    if (state === "open") return "Answer";
    return null;
  }
  if (state === "active") return "Continue";
  if (state === "open") return "Start";
  return null;
}
