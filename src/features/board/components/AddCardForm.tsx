import { useState } from "react";
import { CheckSquare, Link2, PenLine, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import type { AuthoredCardKind, AuthoredCardRequest } from "../types";

type AddCardFormProps = {
  /** Which kind is being written. The form is not rendered at all until one is chosen. */
  kind: AuthoredCardKind;
  onAdd: (request: AuthoredCardRequest) => Promise<boolean>;
  onClose: () => void;
};

const ADD_CARD_KINDS: { kind: AuthoredCardKind; label: string; icon: LucideIcon }[] = [
  { kind: "NOTE", label: "Note", icon: PenLine },
  { kind: "LINK", label: "Link", icon: Link2 },
  { kind: "CHECKLIST", label: "Checklist", icon: CheckSquare },
];

type AddCardTriggersProps = {
  onPick: (kind: AuthoredCardKind) => void;
  /** Which one is open, so the row can show where the form below it came from. */
  active: AuthoredCardKind | null;
  /** Drops the words and keeps the glyphs, for the narrow rail in the page's own margin. */
  compact?: boolean;
  /** Stacks them, for the rail: three glyphs down the margin rather than across it. */
  vertical?: boolean;
  className?: string;
};

/**
 * The three offers: a note, a link, a list.
 *
 * Split out from the form because they now appear in two places at once. On a wide screen they sit
 * in the page's right margin, which is dead space on every board and the natural home for something
 * always available and rarely urgent; below that width there is no margin to speak of, so they stay
 * in the row above the board where they have always been. Both drive the same choice, and the form
 * opens in the same place either way — over the board, where there is room to type.
 */
export function AddCardTriggers({
  onPick,
  active,
  compact,
  vertical,
  className = "",
}: AddCardTriggersProps) {
  return (
    <div className={`flex items-center gap-1 ${vertical ? "flex-col" : "flex-wrap"} ${className}`}>
      {ADD_CARD_KINDS.map(({ kind, label, icon: Icon }) => (
        <Button
          key={kind}
          variant={active === kind ? "secondary" : "ghost"}
          size="sm"
          iconOnly={compact}
          onClick={() => onPick(kind)}
          aria-label={compact ? `Add a ${label.toLowerCase()}` : undefined}
          title={compact ? `Add a ${label.toLowerCase()}` : undefined}
          icon={compact ? undefined : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          {compact ? <Icon className="h-4 w-4" aria-hidden="true" /> : label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Putting something of your own on the board.
 *
 * Three kinds, named plainly, with the form for the chosen one right there — rather than a menu
 * that opens a dialog that contains a form. This is the smallest thing on the page and it should
 * take one decision and one sentence.
 *
 * The three triggers sit quietly at the right, above the board rather than in front of it: they
 * are always available and rarely the reason somebody opened the page. `+ Note` says what it does
 * on its own, so the row carries no sentence introducing it, and the empty board — the one place
 * where the offer needs explaining — explains it there instead.
 *
 * The submit button is disabled until the card would say something, which is the same rule the
 * server enforces: a blank card nobody can explain later is worse than a button that waits.
 *
 * Built from the shared controls (`Button`, `Field`, `Input`, `Textarea`) rather than hand-styled
 * ones, so the prompt is a real `<label>` bound to its control and the form matches every other
 * form in the app.
 */
export function AddCardForm({ kind, onAdd, onClose }: AddCardFormProps) {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [noteTitle, setNoteTitle] = useState("");

  const close = () => {
    setText("");
    setLabel("");
    setNoteTitle("");
    onClose();
  };

  const submit = async () => {
    const request = buildRequest(kind, text, label, noteTitle);
    if (!request) return;
    if (await onAdd(request)) close();
  };

  const fieldId = `add-card-${kind.toLowerCase()}`;

  return (
    <form
      className="space-y-3 rounded-2xl border border-app-border bg-app-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-3">
          {kind === "NOTE" && (
            <Field label="Title (optional)" controlId={`${fieldId}-title`}>
              <Input
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="What is this about?"
              />
            </Field>
          )}

          <Field label={promptFor(kind)} controlId={fieldId}>
            {kind === "NOTE" ? (
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                minRows={3}
              />
            ) : (
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={kind === "LINK" ? "https://…" : "What is this list for?"}
              />
            )}
          </Field>
        </div>

        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={close}
          aria-label="Cancel adding a card"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {kind === "LINK" && (
        <Field label="What to call it (optional)" controlId={`${fieldId}-label`}>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
      )}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={buildRequest(kind, text, label, noteTitle) === null}
      >
        Add to my board
      </Button>
    </form>
  );
}

function promptFor(kind: AuthoredCardKind): string {
  switch (kind) {
    case "NOTE":
      return "What do you want to remember?";
    case "LINK":
      return "Which link do you want to keep?";
    case "CHECKLIST":
      return "What are you keeping a list of?";
  }
}

/**
 * The request for what has been typed so far, or null when the card would say nothing.
 *
 * A note may be a title, a body, or both — either alone is a note worth keeping, and the two are
 * joined with a newline because that is how the card reads a heading back off it.
 *
 * A checklist is the exception and starts empty on purpose: that is a list somebody is about to
 * fill in, which is a real thing to make. A title is optional there too.
 */
function buildRequest(
  kind: AuthoredCardKind | null,
  text: string,
  label: string,
  noteTitle = "",
): AuthoredCardRequest | null {
  const trimmed = text.trim();
  switch (kind) {
    case "NOTE": {
      // A note's title is its first line, which is where the card already reads its heading from.
      // So a titled note needs no field on the wire and no migration, and a note somebody wrote
      // with a heading of their own before this field existed keeps working exactly as it did.
      const composed = [noteTitle.trim(), trimmed].filter(Boolean).join("\n");
      return composed ? { kind: "NOTE", text: composed } : null;
    }
    case "LINK":
      return trimmed ? { kind: "LINK", url: trimmed, label: label.trim() || null } : null;
    case "CHECKLIST":
      return { kind: "CHECKLIST", title: trimmed || null, items: [] };
    default:
      return null;
  }
}
