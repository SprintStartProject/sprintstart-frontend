import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BoardCardFrame } from "./BoardCardFrame";
import type { AuthoredCardRequest, BoardCard, ChecklistContent, ChecklistItem } from "../types";

type ChecklistCardProps = {
  content: ChecklistContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

/** The items, as the server needs them back: existing ones keep their id, so a tick lands on a line. */
function toRequest(content: ChecklistContent, items: ChecklistItem[]): AuthoredCardRequest {
  return {
    kind: "CHECKLIST",
    title: content.title,
    items: items.map((item) => ({ id: item.id, text: item.text, done: item.done })),
  };
}

/**
 * A list the hire ticks off — the only card whose content changes by being used.
 *
 * Ticking sends the whole list back with the item's id intact, which is what makes it an edit to
 * that line rather than to a position: without ids, adding a line above a ticked item would move
 * the tick.
 *
 * The count is `2/5 done`, never a percentage or a bar. A checklist somebody wrote for themselves
 * is not a progress metric, and dressing it as one invites treating it like a score.
 */
export function ChecklistCard({
  content,
  card,
  onDismiss,
  dismissing,
  onEdit,
  onMove,
  canMoveUp,
  canMoveDown,
}: ChecklistCardProps) {
  const [newItem, setNewItem] = useState("");
  const done = content.items.filter((item) => item.done).length;

  const toggle = (itemId: string) => {
    onEdit?.(
      card.id,
      toRequest(
        content,
        content.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
      ),
    );
  };

  const remove = (itemId: string) => {
    onEdit?.(
      card.id,
      toRequest(
        content,
        content.items.filter((item) => item.id !== itemId),
      ),
    );
  };

  const add = () => {
    const text = newItem.trim();
    if (!text) return;
    onEdit?.(card.id, {
      kind: "CHECKLIST",
      title: content.title,
      items: [
        ...content.items.map((item) => ({ id: item.id, text: item.text, done: item.done })),
        // No id: the server mints one, so two tabs adding a line cannot mint the same one.
        { text, done: false },
      ],
    });
    setNewItem("");
  };

  return (
    <BoardCardFrame
      title={content.title ?? "Checklist"}
      card={card}
      subtitle={content.items.length > 0 ? `${done}/${content.items.length} done` : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    >
      {content.items.length === 0 ? (
        <p className="text-sm text-app-text-muted">Nothing on it yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {content.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`item-${item.id}`}
                checked={item.done}
                disabled={!onEdit}
                onChange={() => toggle(item.id)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-app-border accent-app-brand"
              />
              <label
                htmlFor={`item-${item.id}`}
                className={`flex-1 text-sm ${
                  item.done ? "text-app-text-muted line-through" : "text-app-text"
                }`}
              >
                {item.text}
              </label>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`Remove "${item.text}"`}
                  className="shrink-0 rounded p-0.5 text-app-text-muted transition hover:text-app-danger-text"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onEdit && (
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor={`add-${card.id}`}>
            Add an item
          </label>
          <input
            id={`add-${card.id}`}
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Add an item"
            className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text outline-none focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
          />
          <button
            type="button"
            onClick={add}
            disabled={newItem.trim().length === 0}
            aria-label="Add this item"
            className="shrink-0 rounded-lg border border-app-border px-2 text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </BoardCardFrame>
  );
}
