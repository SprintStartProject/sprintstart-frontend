import { useState } from "react";
import { CheckSquare, Link2, Plus, StickyNote, X } from "lucide-react";
import type { AuthoredCardKind, AuthoredCardRequest } from "../types";

type AddCardFormProps = {
  onAdd: (request: AuthoredCardRequest) => Promise<boolean>;
};

const KINDS: { kind: AuthoredCardKind; label: string; icon: typeof StickyNote }[] = [
  { kind: "NOTE", label: "Note", icon: StickyNote },
  { kind: "LINK", label: "Link", icon: Link2 },
  { kind: "CHECKLIST", label: "Checklist", icon: CheckSquare },
];

/**
 * Putting something of your own on the board.
 *
 * Three kinds, named plainly, with the form for the chosen one right there — rather than a menu
 * that opens a dialog that contains a form. This is the smallest thing on the page and it should
 * take one decision and one sentence.
 *
 * The submit button is disabled until the card would say something, which is the same rule the
 * server enforces: a blank card nobody can explain later is worse than a button that waits.
 */
export function AddCardForm({ onAdd }: AddCardFormProps) {
  const [kind, setKind] = useState<AuthoredCardKind | null>(null);
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");

  const close = () => {
    setKind(null);
    setText("");
    setLabel("");
  };

  const submit = async () => {
    const request = buildRequest(kind, text, label);
    if (!request) return;
    if (await onAdd(request)) close();
  };

  if (!kind) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-app-text-muted">Put something of your own here:</span>
        {KINDS.map(({ kind: option, label: optionLabel, icon: Icon }) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border px-3 py-1.5 text-sm font-medium text-app-text transition hover:bg-app-surface-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {optionLabel}
          </button>
        ))}
      </div>
    );
  }

  const fieldId = `add-card-${kind.toLowerCase()}`;

  return (
    <form
      className="mb-4 rounded-2xl border border-app-border bg-app-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-semibold text-app-text">
          {promptFor(kind)}
        </label>
        <button
          type="button"
          onClick={close}
          aria-label="Cancel adding a card"
          className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {kind === "NOTE" ? (
        <textarea
          id={fieldId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-app-border bg-app-bg p-2 text-sm text-app-text outline-none focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
        />
      ) : (
        <input
          id={fieldId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={kind === "LINK" ? "https://…" : "What is this list for?"}
          className="w-full rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text outline-none focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
        />
      )}

      {kind === "LINK" && (
        <>
          <label htmlFor={`${fieldId}-label`} className="sr-only">
            What to call it (optional)
          </label>
          <input
            id={`${fieldId}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="What to call it (optional)"
            className="mt-2 w-full rounded-xl border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text outline-none focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
          />
        </>
      )}

      <button
        type="submit"
        disabled={buildRequest(kind, text, label) === null}
        className="mt-3 rounded-lg bg-app-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        Add to my board
      </button>
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
 * A checklist is the exception and starts empty on purpose: that is a list somebody is about to
 * fill in, which is a real thing to make. A title is optional there too.
 */
function buildRequest(
  kind: AuthoredCardKind | null,
  text: string,
  label: string,
): AuthoredCardRequest | null {
  const trimmed = text.trim();
  switch (kind) {
    case "NOTE":
      return trimmed ? { kind: "NOTE", text: trimmed } : null;
    case "LINK":
      return trimmed ? { kind: "LINK", url: trimmed, label: label.trim() || null } : null;
    case "CHECKLIST":
      return { kind: "CHECKLIST", title: trimmed || null, items: [] };
    default:
      return null;
  }
}
