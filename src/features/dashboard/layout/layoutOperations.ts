// ============================================================
// features/dashboard/layout/layoutOperations.ts
// ============================================================
// Every change the edit mode can make to a layout, as pure
// functions over the array. The hook owns the state; these own
// the rules.
// ============================================================

import type {
  DashboardLayout,
  DashboardWidgetDefinition,
  DashboardWidgetId,
  DashboardWidgetSize,
} from "./types";

/**
 * Exactly one widget opens the slot beside the knowledge base, the first that applies.
 *
 * This is the precedence #282 and #288 settled on: a running onboarding is the user's own
 * and finite, so it outranks team insights, and conversations catch everybody else.
 */
const DEFAULT_SLOT_CANDIDATES: readonly DashboardWidgetId[] = [
  "onboarding",
  "team-insights",
  "recent-chats",
];

/** What sits around that slot, in reading order. */
const DEFAULT_SURROUNDINGS: readonly { id: DashboardWidgetId; size: DashboardWidgetSize }[] = [
  { id: "greeting", size: "wide" },
  { id: "knowledge-base", size: "medium" },
  { id: "ask-chat", size: "wide" },
  { id: "skills", size: "wide" },
];

/**
 * Builds the starting layout: today's dashboard, in today's order.
 *
 * Only decides what a user finds the first time — everything after that is theirs, and
 * "reset" brings them back here.
 *
 * @param availableIds The widget ids {@link DashboardWidgetDefinition.isAvailable} said yes
 *   to. Anything not in here is skipped rather than placed as a card that cannot load.
 */
export function buildDefaultLayout(availableIds: readonly DashboardWidgetId[]): DashboardLayout {
  const available = new Set(availableIds);
  const slotId = DEFAULT_SLOT_CANDIDATES.find((id) => available.has(id));

  return DEFAULT_SURROUNDINGS.filter((item) => available.has(item.id)).flatMap((item) =>
    // The slot sits between the greeting and the knowledge base, which is where the
    // onboarding and conversation cards have always been.
    item.id === "knowledge-base" && slotId !== undefined
      ? [{ id: slotId, size: "medium" }, item]
      : [item],
  );
}

/**
 * Drops anything the user may no longer have and de-duplicates the rest.
 *
 * A stored layout outlives the role that produced it: a PM who loses the selected project,
 * a member who finishes their onboarding. Reading is where that is noticed, so the grid
 * never has to render a widget that would only fail.
 */
export function reconcileLayout(
  layout: DashboardLayout,
  availableIds: readonly DashboardWidgetId[],
): DashboardLayout {
  const available = new Set(availableIds);
  const seen = new Set<DashboardWidgetId>();

  return layout.filter((item) => {
    if (!available.has(item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * Replaces the set of placed widgets in one go, keeping everything the user has already
 * arranged exactly where and how it was.
 *
 * The picker's operation, and the only way a widget is placed. Removing one at a time still
 * exists for the card's own control on the board; this is the batch behind a dialog where
 * somebody ticks several boxes and presses save, and the difference matters: a kept widget
 * must not lose its position
 * or the size it was given just because the picker was opened, so the existing layout is
 * filtered rather than rebuilt.
 *
 * Newly ticked widgets go on the end, in catalog order, at their default size — the same
 * place and shape a single "add" would have put them.
 */
export function setPlacedWidgets(
  layout: DashboardLayout,
  selectedIds: ReadonlySet<DashboardWidgetId>,
  available: readonly DashboardWidgetDefinition[],
): DashboardLayout {
  const kept = layout.filter((item) => selectedIds.has(item.id));
  const alreadyPlaced = new Set(kept.map((item) => item.id));

  const added = available
    .filter((widget) => selectedIds.has(widget.id) && !alreadyPlaced.has(widget.id))
    .map((widget) => ({ id: widget.id, size: widget.defaultSize }));

  return [...kept, ...added];
}

export function removeWidget(layout: DashboardLayout, id: DashboardWidgetId): DashboardLayout {
  return layout.filter((item) => item.id !== id);
}

export function resizeWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  size: DashboardWidgetSize,
): DashboardLayout {
  return layout.map((item) => (item.id === id ? { ...item, size } : item));
}

/**
 * Moves `id` to where `targetId` currently sits, pushing the rest along.
 *
 * The whole reordering model is this one operation: the grid places widgets in array order
 * and lets CSS wrap them, so dragging never has to think in coordinates and a layout can
 * never end up with a hole in it.
 */
export function moveWidgetTo(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  targetId: DashboardWidgetId,
): DashboardLayout {
  if (id === targetId) return layout;

  const from = layout.findIndex((item) => item.id === id);
  const to = layout.findIndex((item) => item.id === targetId);
  if (from < 0 || to < 0) return layout;

  const next = [...layout];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  return next;
}

/**
 * Moves a widget one place earlier or later.
 *
 * The keyboard's way to do what dragging does with a pointer — an edit mode reachable only
 * by mouse would put the whole feature behind a pointing device.
 */
export function moveWidgetBy(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  offset: number,
): DashboardLayout {
  const from = layout.findIndex((item) => item.id === id);
  if (from < 0) return layout;

  const to = from + offset;
  if (to < 0 || to >= layout.length) return layout;

  return moveWidgetTo(layout, id, layout[to].id);
}
