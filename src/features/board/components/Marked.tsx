import { Fragment, useState } from "react";

import { splitMarks } from "../marks/markup";
import { DEFAULT_HIGHLIGHT, HIGHLIGHT_CLASS, type HighlightColor } from "../marks/highlightColors";
import { useCardMarks } from "../marks/useCardMarks";
import { MarkPopover } from "./MarkPopover";
import type { CardMark } from "../marks/cardMarks";

/** One run of text, and the colour it is painted — null for the parts nobody marked. */
type Run = { text: string; color: HighlightColor | null };

type MarkedProps = {
  /** The text to draw. For a note this still carries its `==` delimiters. */
  text: string;
  /**
   * The card's stored marks.
   *
   * On a note these carry *colour only* — which words are marked is written into the text itself,
   * so a note read on a machine that has never seen this storage is still marked, just yellow. On
   * every other kind they carry both. See `marks/cardMarks.ts`.
   */
  marks?: CardMark[];
  /** True for a note: read `==` out of the text as well as looking colours up in `marks`. */
  parse?: boolean;
  /**
   * The card this text belongs to. Given, every highlight becomes something you can point at.
   *
   * Left out where there is nothing to act on — a card drawn outside the board, or in a test. The
   * marks then render as plain highlights, which is what they were before any of this.
   */
  cardId?: string;
  className?: string;
};

/**
 * Text with the hire's highlights in it.
 *
 * One renderer for both ways a mark is stored, because the difference between them is where the
 * mark *lives* and not what it looks like: a highlighted sentence on a note and a highlighted
 * sentence on a memory recap are the same gesture and have to read as one.
 *
 * A real `<mark>`, not a styled span. It is the element that means this, it is what a screen reader
 * announces as highlighted, and it is the one that survives somebody printing the board.
 */
export function Marked({ text, marks = [], parse = false, cardId, className = "" }: MarkedProps) {
  const { canMark, mark, unmark } = useCardMarks();
  /** The highlight whose little bar is open, and where on screen it was when it was clicked. */
  const [open, setOpen] = useState<{ text: string; color: HighlightColor; rect: DOMRect } | null>(
    null,
  );

  const runs = parse ? runsFromMarkup(text, marks) : runsFromMarks(text, marks);
  const interactive = canMark && cardId !== undefined;

  /**
   * Opens the bar for a highlight, unless the click was the end of a drag across it.
   *
   * A click fires on mouse-up even when that mouse-up finished a selection, so without this,
   * selecting words *inside* a highlight would open this bar at the same moment the selection
   * toolbar appears over the same text — two menus for one gesture, and the one nobody asked for
   * on top.
   */
  function openFor(run: Run, element: HTMLElement) {
    if (!run.color) return;
    if (window.getSelection()?.isCollapsed === false) return;

    setOpen({ text: run.text, color: run.color, rect: element.getBoundingClientRect() });
  }

  return (
    <span className={className}>
      {runs.map((run, index) =>
        run.color ? (
          // `rounded-sm` and a little horizontal padding, so a highlight over one word reads as a
          // stroke of a pen rather than as a coloured box the word is trapped in. The ink is left
          // alone — a highlighter changes the paper, not the writing.
          //
          // A `<mark>` carrying a button role rather than a real `<button>`, which is the one place
          // this gives up the better element for the better behaviour: an inline-block button does
          // not wrap, so a highlight spanning three lines would be dragged onto one and off the
          // side of the card. `<mark>` wraps like the prose it is part of, keeps the meaning for a
          // screen reader, and still answers Ctrl+F.
          <mark
            key={index}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `Highlight: ${run.text}. Change its colour or remove it`,
                  onClick: (event: React.MouseEvent<HTMLElement>) =>
                    openFor(run, event.currentTarget),
                  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    openFor(run, event.currentTarget);
                  },
                }
              : {})}
            className={`rounded-sm px-0.5 text-inherit ${HIGHLIGHT_CLASS[run.color]} ${
              interactive
                ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                : ""
            }`}
          >
            {run.text}
          </mark>
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}

      {open && cardId && (
        <MarkPopover
          anchor={open.rect}
          color={open.color}
          onPick={(color) => {
            mark(cardId, open.text, color);
            setOpen(null);
          }}
          onRemove={() => {
            unmark(cardId, open.text);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </span>
  );
}

/** A note's own `==` runs, coloured from the card's stored marks and yellow where none is stored. */
function runsFromMarkup(text: string, marks: CardMark[]): Run[] {
  return splitMarks(text).map((run) => ({
    text: run.text,
    color: run.marked
      ? (marks.find((mark) => mark.text === run.text)?.color ?? DEFAULT_HIGHLIGHT)
      : null,
  }));
}

/**
 * The runs a list of marked strings makes out of a piece of text.
 *
 * Every occurrence of every mark, not just the first: these cards are re-read from the server and a
 * mark is only ever matched by its words, so "the one they meant" is not a question this can answer.
 * Highlighting all of them is the honest reading of "these words matter".
 *
 * Longest first, so a mark that contains another one wins rather than being cut in half by it.
 */
function runsFromMarks(text: string, marks: CardMark[]): Run[] {
  const wanted = [...marks].sort((a, b) => b.text.length - a.text.length);
  const runs: Run[] = [];
  let rest = text;

  while (rest.length > 0) {
    let at = -1;
    let hit: CardMark | null = null;

    for (const mark of wanted) {
      const found = rest.indexOf(mark.text);
      if (found !== -1 && (at === -1 || found < at)) {
        at = found;
        hit = mark;
      }
    }

    if (at === -1 || !hit) break;

    if (at > 0) runs.push({ text: rest.slice(0, at), color: null });
    runs.push({ text: hit.text, color: hit.color });
    rest = rest.slice(at + hit.text.length);
  }

  if (rest.length > 0) runs.push({ text: rest, color: null });

  return runs;
}
