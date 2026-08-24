import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Textarea";
import { BoardCardFrame } from "./BoardCardFrame";
import type { AuthoredCardRequest, BoardCard, NoteContent } from "../types";

type NoteCardProps = {
  content: NoteContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

/**
 * Something the hire wrote down.
 *
 * Rendered as plain text rather than as markdown: the board renders one other kind of prose — the
 * mentor's, which is cited — and rendering the hire's own note through the same pipe would make the
 * two look alike. A note is theirs, and it should read like a sticky note, not like documentation.
 *
 * Editing is in place. There is no separate view/edit route because a note is three lines long, and
 * a route change to fix a typo is more ceremony than the typo.
 */
export function NoteCard({
  content,
  card,
  onDismiss,
  dismissing,
  onEdit,
  onMove,
  canMoveUp,
  canMoveDown,
}: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content.text);

  const save = () => {
    onEdit?.(card.id, { kind: "NOTE", text: draft });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(content.text);
    setEditing(false);
  };

  return (
    <BoardCardFrame
      title="Note"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      action={
        onEdit && !editing ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setEditing(true)}
            aria-label="Edit this note"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <div>
          <label className="sr-only" htmlFor={`note-${card.id}`}>
            Note text
          </label>
          <Textarea
            id={`note-${card.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            minRows={4}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={draft.trim().length === 0}
              icon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={cancel}
              icon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-app-text">{content.text}</p>
      )}
    </BoardCardFrame>
  );
}
