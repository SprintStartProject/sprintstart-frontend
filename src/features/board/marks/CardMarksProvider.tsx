import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CardMarksContext, type MarkableBoard } from "./CardMarksContext";
import {
  colorOf,
  enclosingCardMark,
  marksOf,
  readCardMarks,
  removeCardMark,
  setCardMark,
  writeCardMarks,
  type CardMarks,
} from "./cardMarks";
import { addMark, enclosingMark, isMarked, markGroup, splitMarks, unmarkPart } from "./markup";
import { DEFAULT_HIGHLIGHT, type HighlightColor } from "./highlightColors";
import { readMarkLabels, setMarkLabel, writeMarkLabels, type MarkLabels } from "./markLabels";
import { useProjectContext } from "../../projects/useProjectContext";
import { useToastApi } from "../../../context/useToast";
import { subscribeToBoardStorageReplaced } from "../layout/boardStorage";
import type { BoardCard } from "../types";

/**
 * Holds the board's highlights, and decides which of the two storages a given mark belongs in.
 *
 * That decision is the whole reason this exists, and it is made from the card's kind:
 *
 * - A `NOTE` is the hire's own text, so *whether* something is marked goes into that text as
 *   `==like this==` and travels with the card — to the server, to another machine, into the edit
 *   box where it can be taken off by hand. Its *colour* cannot go there (nobody types
 *   `==text=={green}` on purpose), so that is kept beside the card and degrades to yellow where
 *   the storage has not been seen. A degraded highlight is still a highlight.
 * - Everything else is read from the server on every visit and has nowhere to put a delimiter, so
 *   both halves are kept beside the card.
 *
 * Callers never see the difference, which is deliberate: two kinds of highlight behaving
 * differently under one gesture would be a thing to learn rather than a marker pen.
 *
 * Mounted in the app shell beside `FocusModeProvider`, not on the board page, because the surface
 * that *makes* a highlight — the selection toolbar — is mounted above the router. The page under it
 * lends its cards through `useMarkableBoard`.
 */
export function CardMarksProvider({ children }: { children: ReactNode }) {
  const { selectedProjectId } = useProjectContext();
  // The stable half of the toast API: this provider sits above the whole app, and the toast list
  // changing must not re-render it.
  const toast = useToastApi();

  const [marks, setMarks] = useState<CardMarks>({});
  const [labels, setLabels] = useState<MarkLabels>({});
  const [readFor, setReadFor] = useState<string | null>(null);

  if (selectedProjectId !== readFor) {
    setReadFor(selectedProjectId);
    setMarks(readCardMarks(selectedProjectId));
    setLabels(readMarkLabels(selectedProjectId));
  }

  // And again when the stored arrangement is replaced under us — this hire's highlights arriving
  // from the server on the first load of a visit. Only *replaced*: re-reading after our own writes
  // would re-seat state we just set.
  useEffect(
    () =>
      subscribeToBoardStorageReplaced(() => {
        setMarks(readCardMarks(selectedProjectId));
        setLabels(readMarkLabels(selectedProjectId));
      }),
    [selectedProjectId],
  );

  const nameColor = useCallback(
    (color: HighlightColor, name: string) => {
      setLabels((current) => {
        const next = setMarkLabel(current, color, name);
        writeMarkLabels(selectedProjectId, next);

        return next;
      });
    },
    [selectedProjectId],
  );

  // A ref rather than state: the cards are re-handed after every render of the page below, and
  // storing them in state would make each of those renders cause another one. Nothing reads this
  // while drawing — only the handlers, from a click.
  const board = useRef<MarkableBoard | null>(null);
  const [hasBoard, setHasBoard] = useState(false);

  const setBoard = useCallback((next: MarkableBoard | null) => {
    board.current = next;
    // Same value on every render but the first and the last, so React bails out of all the others.
    setHasBoard(next !== null);
  }, []);

  const cardById = useCallback(
    (cardId: string): BoardCard | undefined =>
      board.current?.cards.find((candidate) => candidate.id === cardId),
    [],
  );

  const marksFor = useCallback((cardId: string) => marksOf(marks, cardId), [marks]);

  const colorAt = useCallback(
    (cardId: string, selected: string): HighlightColor | null => {
      const card = cardById(cardId);
      if (!card) return null;

      const stored = colorOf(marksOf(marks, cardId), selected);

      // On a note the text is the authority on *whether* something is marked: a highlight made on
      // another machine has no colour entry here, and reporting it as unmarked would offer to mark
      // it again rather than to take it off.
      if (card.content.kind === "NOTE") {
        return isMarked(card.content.text, selected) ? (stored ?? DEFAULT_HIGHLIGHT) : null;
      }

      return stored;
    },
    [cardById, marks],
  );

  const enclosingColorAt = useCallback(
    (cardId: string, selected: string): HighlightColor | null => {
      const card = cardById(cardId);
      if (!card) return null;

      const stored = enclosingCardMark(marksOf(marks, cardId), selected);

      // On a note the text is the authority on *whether* something is marked — a highlight made on
      // another machine has no colour entry here, and reporting it as unmarked would hide the
      // eraser on the one highlight the hire can see.
      if (card.content.kind === "NOTE") {
        return enclosingMark(card.content.text, selected) === null
          ? null
          : (stored?.color ?? DEFAULT_HIGHLIGHT);
      }

      return stored?.color ?? null;
    },
    [cardById, marks],
  );

  /** The colour a note's highlight is drawn in — its stored colour, or yellow where none is. */
  const colorIn = useCallback(
    (cardId: string) => (run: string) => colorOf(marksOf(marks, cardId), run) ?? DEFAULT_HIGHLIGHT,
    [marks],
  );

  /** Stores a colour beside the card, or drops it. The one write both storages share. */
  const writeColor = useCallback(
    (cardId: string, selected: string, color: HighlightColor | null) => {
      setMarks((current) => {
        const next = color
          ? setCardMark(current, cardId, selected, color)
          : removeCardMark(current, cardId, selected);

        writeCardMarks(selectedProjectId, next);

        return next;
      });
    },
    [selectedProjectId],
  );

  const mark = useCallback(
    (cardId: string, selected: string, color: HighlightColor) => {
      const card = cardById(cardId);
      if (!card) return;

      if (card.content.kind === "NOTE") {
        const text = card.content.text;

        // A new colour for a highlight that is already there: the whole of it, every piece one
        // stroke over a list or across a paragraph left behind (see `markGroup`).
        if (isMarked(text, selected)) {
          const group = markGroup(text, selected, colorIn(cardId));
          for (const piece of group?.texts ?? [selected]) writeColor(cardId, piece, color);
          return;
        }

        // Painting part of an existing highlight: cut it out of the old one first, then mark it on
        // its own. Wrapping it where it stands would nest one pair of delimiters inside another,
        // and the parser closes at the first `==` it meets.
        const around = enclosingMark(text, selected);
        const cut = around !== null ? unmarkPart(text, selected) : text;
        const next = addMark(cut, selected);

        // Unchanged and not already marked means the selection spans something no single run
        // contains — a heading and the body, two cards, or text drawn from formatting (a bold
        // word, a link, a step chip) in a note the buddy wrote in Markdown. Nothing to paint, so
        // nothing is stored — and the hire is told, rather than left wondering why nothing lit.
        if (next === cut) {
          toast.info("That can't be highlighted", {
            description: "Try a shorter piece of plain text, without links or formatting in it.",
          });
          return;
        }
        board.current?.onEditCard?.(cardId, { kind: "NOTE", text: next });

        // Every piece the stroke became takes the colour — a selection over three list items is
        // three `==…==`, and a colour stored only under the whole selection would match none.
        for (const piece of newPieces(cut, next)) writeColor(cardId, piece, color);
        // What is left of a highlight that was painted over in part keeps the colour it had.
        if (around !== null) {
          const was = colorIn(cardId)(around);
          for (const piece of newPieces(text, cut)) writeColor(cardId, piece, was);
        }
        return;
      } else {
        // The same cut, on the other storage: what was around the selection keeps the colour it
        // had, and the selection itself takes the new one from `writeColor` below.
        writeColor(cardId, selected, null);
      }

      writeColor(cardId, selected, color);
    },
    [cardById, colorIn, toast, writeColor],
  );

  const unmark = useCallback(
    (cardId: string, selected: string) => {
      const card = cardById(cardId);
      if (!card) return;

      if (card.content.kind === "NOTE") {
        // Removing a whole highlight takes all of it: every piece of one stroke (see `markGroup`).
        const group = isMarked(card.content.text, selected)
          ? markGroup(card.content.text, selected, colorIn(cardId))
          : null;
        if (group) {
          board.current?.onEditCard?.(cardId, { kind: "NOTE", text: group.without });
          for (const piece of group.texts) writeColor(cardId, piece, null);
          return;
        }

        const next = unmarkPart(card.content.text, selected);
        if (next !== card.content.text) {
          board.current?.onEditCard?.(cardId, { kind: "NOTE", text: next });
        }
      }

      writeColor(cardId, selected, null);
    },
    [cardById, colorIn, writeColor],
  );

  const value = useMemo(
    () => ({
      canMark: hasBoard,
      marksFor,
      colorAt,
      enclosingColorAt,
      mark,
      unmark,
      // A note highlighted anywhere always gets a colour entry too, so the map answers this for
      // every kind without having to walk the cards' text.
      hasAnyMarks: Object.keys(marks).length > 0,
      marks,
      labels,
      nameColor,
      setBoard,
    }),
    [
      hasBoard,
      marksFor,
      colorAt,
      enclosingColorAt,
      mark,
      unmark,
      marks,
      labels,
      nameColor,
      setBoard,
    ],
  );

  return <CardMarksContext.Provider value={value}>{children}</CardMarksContext.Provider>;
}

/** The highlights `next` has that `before` did not — what one stroke of the pen just made. */
function newPieces(before: string, next: string): string[] {
  const had = splitMarks(before)
    .filter((run) => run.marked)
    .map((run) => run.text);
  const pieces: string[] = [];
  for (const run of splitMarks(next)) {
    if (!run.marked) continue;
    const known = had.indexOf(run.text);
    if (known === -1) pieces.push(run.text);
    else had.splice(known, 1);
  }
  return pieces;
}
