import { useMemo, useState } from "react";
import { Check, CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { SelectionCheckbox } from "../../admin/components/SelectionCheckbox";
import { BoardCardFrame } from "./BoardCardFrame";
import type { AuthoredCardRequest, BoardCard, ChecklistContent, ChecklistItem } from "../types";

type ChecklistCardProps = {
  content: ChecklistContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
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
 * **Done sinks to the bottom, and only on screen.** What is left to do is why somebody opens a
 * checklist, and it should not be interleaved with what is finished. The stored order is untouched
 * — sorting here would mean a tick silently rewrote the list the hire wrote, and unticking would
 * have nowhere to put the line back.
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
}: ChecklistCardProps) {
  const [newItem, setNewItem] = useState("");
  const done = content.items.filter((item) => item.done).length;

  // `sort` is stable, so within each half the hire's own order survives.
  const shown = useMemo(
    () => [...content.items].sort((a, b) => Number(a.done) - Number(b.done)),
    [content.items],
  );

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
      icon={CheckSquare}
      title={content.title ?? "Checklist"}
      card={card}
      subtitle={content.items.length > 0 ? `${done}/${content.items.length} done` : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {content.items.length === 0 ? (
        <EmptyState size="sm">Nothing on it yet.</EmptyState>
      ) : (
        <ul className="space-y-1">
          {shown.map((item) => (
            <li key={item.id} className="group/item flex items-center gap-2.5">
              {onEdit ? (
                <SelectionCheckbox
                  checked={item.done}
                  onChange={() => toggle(item.id)}
                  ariaLabel={item.text}
                />
              ) : (
                // Nothing to tick when the board is not editable, so this is a picture of the
                // state rather than a control that would refuse.
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
                    item.done
                      ? "border-app-brand bg-app-brand text-white"
                      : "border-app-border bg-app-surface"
                  }`}
                >
                  {item.done && <Check className="h-4 w-4 stroke-3" />}
                </span>
              )}

              <span
                className={`flex-1 text-sm ${
                  item.done ? "text-app-text-muted line-through" : "text-app-text"
                }`}
              >
                {item.text}
                {!onEdit && (
                  <span className="sr-only">{item.done ? " — done" : " — not done"}</span>
                )}
              </span>

              {onEdit && (
                <Button
                  variant="dangerGhost"
                  size="sm"
                  iconOnly
                  onClick={() => remove(item.id)}
                  aria-label={`Remove "${item.text}"`}
                  className="opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
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
          <Input
            id={`add-${card.id}`}
            size="sm"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder="Add an item"
            className="min-w-0 flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            onClick={add}
            disabled={newItem.trim().length === 0}
            aria-label="Add this item"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </BoardCardFrame>
  );
}
