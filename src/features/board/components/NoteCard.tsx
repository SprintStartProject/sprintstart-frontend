import { useState } from "react";
import { Check, ChevronDown, ChevronUp, PenLine, Pencil, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { BoardCardFrame } from "./BoardCardFrame";
import { CardOriginLink } from "./CardOriginLink";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { questionAboutNote } from "../generation/cardQuestion";
import { Marked } from "./Marked";
import { useCardMarks } from "../marks/useCardMarks";
import type { CardMark } from "../marks/cardMarks";
import type { CardOrigin } from "../layout/cardOrigins";
import type { AuthoredCardRequest, BoardCard, NoteContent } from "../types";

type NoteCardProps = {
  content: NoteContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  /** Where this note was made from, when it was made from something. See `layout/cardOrigins.ts`. */
  origin?: CardOrigin | null;
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
export function NoteCard({ content, card, onDismiss, dismissing, onEdit, origin }: NoteCardProps) {
  const { heading, body } = splitNote(content.text);
  // Colour only: which words are marked is written into the note's own text. See `marks/`.
  const marks = useCardMarks().marksFor(card.id);

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
      title={
        editing ? (
          "Note"
        ) : (
          // The first line is the note's own words, so it can be marked like any other part of it.
          // `controlLabel` below keeps the card's controls saying "the note card" rather than
          // trying to put a highlighted sentence inside an accessible name.
          <Marked text={heading} marks={marks} parse cardId={card.id} />
        )
      }
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
      ) : (
        <>
          {body && <NoteBody body={body} marks={marks} cardId={card.id} />}
          <CardOriginLink origin={origin ?? null} />
          {/* A note kept from a paragraph somebody did not follow is precisely the thing they want
              to ask about, and it was the one kind of card with no way to. What they highlighted in
              it seeds the question ahead of the note itself — see `generation/cardQuestion.ts`. */}
          <AskTheBuddy
            question={questionAboutNote(
              content.text,
              marks.map((mark) => mark.text),
            )}
          />
        </>
      )}
    </BoardCardFrame>
  );
}

/**
 * How much of a note is shown before the rest has to be asked for.
 *
 * Two limits rather than one, because the two ways a note gets long are different shapes. A frozen
 * conversation is many short lines and would blow past a line count while barely reaching a
 * character count; a pasted paragraph is the other way round. Either one alone lets the other
 * through, and a single card three screens tall is the thing the board exists to prevent.
 */
const COLLAPSE_AFTER_CHARS = 320;
const COLLAPSE_AFTER_LINES = 8;

/**
 * The opening of a long note, cut at a line and then at a word so it never stops mid-sentence.
 *
 * Deliberately not a CSS clamp. A clamp renders the whole note and hides most of it, which means
 * the board's column packing still measures a card three screens tall — the layout would leave a
 * hole the size of the collapsed content. Cutting the text is the only version where a folded card
 * is actually small.
 */
function preview(body: string): string {
  const byLine = body.split("\n").slice(0, COLLAPSE_AFTER_LINES).join("\n");
  const cut = byLine.slice(0, COLLAPSE_AFTER_CHARS);
  if (cut === body) return body;

  const lastSpace = cut.lastIndexOf(" ");
  const kept = lastSpace > COLLAPSE_AFTER_CHARS / 2 ? cut.slice(0, lastSpace) : cut;

  return `${kept.trimEnd()}…`;
}

/**
 * A note's text, folded when there is a lot of it.
 *
 * The fold exists for the notes that are not sticky notes: a buddy reply somebody kept, a whole
 * conversation frozen into one card. Those are worth having on the board and are not worth reading
 * every time you look at it — so the card shows what it is and opens on request, and a board of
 * twenty cards stays a board rather than a document.
 *
 * A short note is not wrapped in any of this: no button, no state, exactly the paragraph it was
 * before. Most notes are three lines long and a "show more" under three lines is furniture.
 */
function NoteBody({ body, marks, cardId }: { body: string; marks: CardMark[]; cardId: string }) {
  const [expanded, setExpanded] = useState(false);

  const long = body.length > COLLAPSE_AFTER_CHARS || body.split("\n").length > COLLAPSE_AFTER_LINES;
  if (!long)
    return (
      <p className="text-sm whitespace-pre-wrap text-app-text">
        <Marked text={body} marks={marks} parse cardId={cardId} />
      </p>
    );

  return (
    <div>
      <p className="text-sm whitespace-pre-wrap text-app-text">
        {/* The fold cuts the *raw* text, delimiters and all, so a highlight that straddles the cut
            would lose its closing `==` and stop being one. `preview` keeps whole lines and whole
            words, so the only way to split a mark is to have written one across a line break —
            and `Marked` renders an unclosed pair as ordinary text rather than lighting up the
            rest of the card. */}
        <Marked text={expanded ? body : preview(body)} marks={marks} parse cardId={cardId} />
      </p>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 -ml-2"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        icon={
          expanded ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )
        }
      >
        {expanded ? "Show less" : "Show the whole thing"}
      </Button>
    </div>
  );
}
