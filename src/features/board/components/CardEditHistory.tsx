import { useState } from "react";
import { Check, ListChecks, Pencil, Undo2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { readableTitle } from "../generation/pathToCards";
import { useCardMarks } from "../marks/useCardMarks";
import { Marked } from "./Marked";
import type {
  BoardActor,
  BoardCardContent,
  BoardCardLastChange,
  BoardCardPrevious,
  BoardUndoNotice,
} from "../types";

type CardEditHistoryProps = {
  cardId: string;
  /** The version the latest edit replaced, straight from the card. */
  previous: BoardCardPrevious;
  /** The card's latest change, so the strip can say what happened, not just that something did. */
  lastChange?: BoardCardLastChange | null;
  /** The card's own name in its controls, e.g. "note" — the undo's accessible name is built from it. */
  controlLabel: string;
  /** Puts the card back to what it said before `previous.replacedAt`. */
  onRestore: (cardId: string, replacedAt: string) => void;
  /** True while this card's own undo is in flight. */
  restoring: boolean;
  /**
   * True while this card is being changed by hand: its editor is open, or a write of its own is in
   * flight. Undo stands down then — a press followed by a save would put the draft back over the
   * restored text, silently, and through no mistake of the hire's.
   */
  paused?: boolean;
  /** What just happened to this card's undo, when anything did. */
  notice?: BoardUndoNotice | null;
};

/**
 * Everything the strip says about an edit's author, per author: the visible sentence per kind of
 * change, the possessive the undo's accessible name ends on, and the disclosure's heading.
 *
 * One map with one fallback, so a wire value this client has never met comes through all three at
 * once. Partial on purpose: an author a newer backend adds falls through to plain words instead of
 * taking the card down with an undefined lookup — and the fallback covers the two places a sighted
 * hire never reads, because "who did this" mislabelled only for the people hearing it is the exact
 * mislabelling this strip exists to prevent.
 */
const ACTOR_WORDS: Partial<
  Record<BoardActor, { edited: string; ticked: string; possessive: string; heading: string }>
> = {
  HIRE: {
    edited: "You edited this",
    ticked: "You changed the ticks",
    possessive: "your own edit",
    heading: "Before your edit",
  },
  BUDDY: {
    edited: "Your buddy rewrote this",
    ticked: "Your buddy changed the ticks",
    possessive: "your buddy's edit",
    heading: "Before your buddy's edit",
  },
};

/** The words for an edit whose author this client has no name for. */
const UNKNOWN_ACTOR_WORDS = {
  edited: "This card was edited",
  ticked: "The ticks changed",
  possessive: "an edit",
  heading: "Before the edit",
};

/**
 * How long ago the edit happened, coarsely and in words.
 *
 * The exact stamp is a hover away; what this line answers is "was this me just now, or something I
 * have not seen" — and a bare date answers neither. Past a week the relative phrasing stops being
 * easier to read than the date, so it becomes one.
 */
function whenPhrase(at: Date): string {
  // A stamp this client cannot read still gets words: the one thing this line must never do is talk
  // about the page — "Invalid Date" — instead of about the edit.
  if (Number.isNaN(at.getTime())) return "at an unknown time";
  const minutes = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The record of a card's most recent edit, and the way back from it.
 *
 * On the card rather than in a toast: a change the hire never saw is exactly what an undo exists to
 * prevent, so its record cannot be something that expires while they are away. It says what
 * happened and when — never just that something changed — and it can show the previous words
 * themselves: somebody who finds different text on their own card needs to read what was there.
 *
 * Only ever rendered for an authored card that carries a `previous` version; live cards hold no
 * stored content and can never have one. The edit's author is named from the snapshot's
 * `replacedBy`, so a hire's own edit is never labelled as the buddy's.
 */
export function CardEditHistory({
  cardId,
  previous,
  lastChange,
  controlLabel,
  onRestore,
  restoring,
  paused = false,
  notice = null,
}: CardEditHistoryProps) {
  const [showing, setShowing] = useState(false);

  // A `TICKED` label only when the snapshot is that tick's: a move that happened afterwards is the
  // card's latest change but not this version's, and these words are about this version.
  const kind =
    lastChange?.change === "TICKED" && lastChange.at === previous.replacedAt ? "TICKED" : "EDITED";
  const actor = ACTOR_WORDS[previous.replacedBy] ?? UNKNOWN_ACTOR_WORDS;
  const words = kind === "TICKED" ? actor.ticked : actor.edited;
  const at = new Date(previous.replacedAt);
  const readableStamp = !Number.isNaN(at.getTime());
  const previousPanelId = `card-edit-history-previous-${cardId}`;
  // A refusal is about one version of a card. While the card still shows that version the line is
  // news; a change that arrives afterwards retires it rather than leaving it above newer content.
  const refused =
    notice?.kind === "stale" &&
    (notice.forReplacedAt === null || notice.forReplacedAt === previous.replacedAt);

  return (
    <div
      data-testid="card-edit-history"
      className="mt-2 rounded-xl border border-app-border-muted bg-app-surface-muted px-2.5 py-2 [[data-arranging]_&]:pointer-events-none"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-text-muted">
        {kind === "TICKED" ? (
          <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}

        <span className="min-w-0 flex-1">
          {words} ·{" "}
          <span title={readableStamp ? at.toLocaleString() : undefined}>{whenPhrase(at)}</span>
        </span>

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showing}
          aria-controls={previousPanelId}
          onClick={() => setShowing((current) => !current)}
          data-testid="card-edit-history-toggle"
        >
          {showing ? "Hide what it said before" : "Show what it said before"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          loading={restoring}
          disabled={paused}
          onClick={() => onRestore(cardId, previous.replacedAt)}
          icon={<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
          aria-label={
            paused
              ? `Undo — put the ${controlLabel} back to what it said before ${actor.possessive} (paused while this card is being changed)`
              : `Undo — put the ${controlLabel} back to what it said before ${actor.possessive}`
          }
          data-testid="card-edit-history-undo"
        >
          Undo
        </Button>
      </div>

      {refused && (
        <p className="mt-1.5 text-xs text-app-warning-text" data-testid="card-edit-history-stale">
          That edit was already replaced — this is the card as it is now.
        </p>
      )}

      {/* The press has no other visible receipt — the card's text changing is the receipt for the
          eye, and this is the same fact for a screen reader. */}
      <span role="status" className="sr-only">
        {notice?.kind === "restored"
          ? `Restored — the ${controlLabel} says what it said before.`
          : ""}
      </span>

      {/* Kept in the DOM while closed — hidden, not absent — so the disclosure's `aria-controls`
          always points at something real; the words themselves render only while it is open. */}
      <div
        id={previousPanelId}
        hidden={!showing}
        data-testid="card-edit-history-previous"
        className="mt-2 rounded-lg border border-app-border-muted bg-app-surface px-2.5 py-2"
      >
        {showing && (
          <>
            <p className="text-xs font-medium text-app-text-muted">{actor.heading}</p>
            <div className="mt-1">
              <PreviousContent content={previous.content} cardId={cardId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The card's words from before the edit, in the visual language the card already reads in.
 *
 * Read-only by construction: nothing in here is focusable or clickable, because the way back is the
 * single Undo beside it, and a snapshot that took edits of its own would be a second, hidden edit
 * path. A link is shown as text — the address it had is history, and reopening it is not what
 * somebody is doing when they check what changed.
 */
function PreviousContent({ content, cardId }: { content: BoardCardContent; cardId: string }) {
  const marks = useCardMarks().marksFor(cardId);

  switch (content.kind) {
    case "NOTE":
      return (
        <p className="text-sm whitespace-pre-wrap text-app-text">
          <Marked text={content.text} marks={marks} parse cardId={cardId} />
        </p>
      );
    case "LINK":
      return (
        <div className="text-sm break-all">
          <p className="font-medium text-app-text">{content.label ?? content.url}</p>
          {content.label && <p className="mt-0.5 text-xs text-app-text-muted">{content.url}</p>}
        </div>
      );
    case "CHECKLIST":
      return (
        <div>
          {content.title && (
            <p className="text-sm font-medium text-app-text">{readableTitle(content.title)}</p>
          )}
          <ul className="mt-1 space-y-1">
            {content.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    item.done
                      ? "border-app-brand bg-app-brand text-white"
                      : "border-app-border bg-app-surface"
                  }`}
                >
                  {item.done && <Check className="h-3.5 w-3.5 stroke-3" />}
                </span>
                <span
                  className={`text-sm ${
                    item.done ? "text-app-text-muted line-through" : "text-app-text"
                  }`}
                >
                  <Marked text={item.text} marks={marks} cardId={cardId} />
                  <span className="sr-only">{item.done ? " — done" : " — not done"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      // Only the authored kinds store content, so nothing else can have a previous version.
      return null;
  }
}
