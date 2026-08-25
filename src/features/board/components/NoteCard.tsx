import { useState } from "react";
import { Check, PenLine, Pencil, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { BoardCardFrame } from "./BoardCardFrame";
import type { AuthoredCardRequest, BoardCard, NoteContent } from "../types";

type NoteCardProps = {
  content: NoteContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
};

/**
 * The note's own first line, and whatever it says after that.
 *
 * A note has no title field and should not grow one — asking somebody to name a sticky note is
 * asking them to do paperwork before they can write down that deploys are on Thursdays. So the
 * first line is read as the heading, which is what people already write: a one-line note becomes a
 * card that says the note, and a longer one gets its own opening line as a title with the rest
 * beneath. The card headed "Note" told the hire nothing they could not see.
 *
 * A note that is only blank lines cannot exist — the form refuses it — but the fallback is kept so
 * an empty heading is never rendered.
 */
function splitNote(text: string): { heading: string; body: string } {
  const newline = text.indexOf("\n");
  if (newline === -1) return { heading: text.trim() || "Note", body: "" };
  return {
    heading: text.slice(0, newline).trim() || "Note",
    body: text.slice(newline + 1).replace(/^\n+/, ""),
  };
}

/**
 * Something the hire wrote down.
 *
 * Rendered as plain text rather than as markdown: the board renders one other kind of prose — the
 * mentor's, which is cited — and rendering the hire's own note through the same pipe would make the
 * two look alike. A note is theirs, and it should read like a sticky note, not like documentation.
 *
 * Editing is in place. There is no separate view/edit route because a note is three lines long, and
 * a route change to fix a typo is more ceremony than the typo. The editor offers the title and the
 * body as separate fields and joins them back into one text on save: the split is how the note is
 * shown *and* how it is written, but never how it is stored — there is no title on the wire.
 */
export function NoteCard({ content, card, onDismiss, dismissing, onEdit }: NoteCardProps) {
  const { heading, body } = splitNote(content.text);

  const [editing, setEditing] = useState(false);
  // Edited as the two things it reads as, rather than as one blob whose first line is secretly the
  // heading. The split is undone on save, so the note on the wire is still one piece of text.
  const [titleDraft, setTitleDraft] = useState(heading);
  const [bodyDraft, setBodyDraft] = useState(body);

  const composed = [titleDraft.trim(), bodyDraft.trim()].filter(Boolean).join("\n");

  const save = () => {
    onEdit?.(card.id, { kind: "NOTE", text: composed });
    setEditing(false);
  };

  const cancel = () => {
    setTitleDraft(heading);
    setBodyDraft(body);
    setEditing(false);
  };

  return (
    <BoardCardFrame
      icon={PenLine}
      title={editing ? "Note" : heading}
      controlLabel="note"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
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
        <div className="space-y-3">
          <Field label="Title (optional)" controlId={`note-title-${card.id}`}>
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="What is this about?"
            />
          </Field>

          <div>
            <label className="sr-only" htmlFor={`note-${card.id}`}>
              Note text
            </label>
            <Textarea
              id={`note-${card.id}`}
              value={bodyDraft}
              onChange={(event) => setBodyDraft(event.target.value)}
              minRows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={composed.length === 0}
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
      ) : body ? (
        <p className="text-sm whitespace-pre-wrap text-app-text">{body}</p>
      ) : null}
    </BoardCardFrame>
  );
}
