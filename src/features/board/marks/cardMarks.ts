import { notifyBoardStorageWritten } from "../layout/boardStorage";
import { DEFAULT_HIGHLIGHT, toHighlightColor, type HighlightColor } from "./highlightColors";

/**
 * The colour of every highlight, and — for the cards whose text is not the hire's to write in —
 * which words are highlighted at all.
 *
 * A note carries its own marks: two equals signs inside its text, which travel with the card to the
 * server and to any other machine (see `markup.ts`). What they cannot carry is a colour, because
 * the delimiters are the hire's own writing and `==text=={green}` would be a syntax nobody typed on
 * purpose. So a note's *colour* is kept here and its *mark* is kept in the note; the colour degrades
 * to yellow on a machine that has never seen this storage, and a degraded highlight is still a
 * highlight.
 *
 * Every other card is read from the server on every visit — a generated checklist, the mentor's
 * memory recap — and has nowhere to put a delimiter either. For those, both halves live here.
 *
 * **Stored as the marked text, never as character offsets.** Those cards are re-read constantly and
 * their contents change under the marks. An offset survives none of that and would leave a
 * highlight over the middle of an unrelated word. A string either still appears in the card or it
 * does not, and when it does not, nothing lights up — the correct answer rather than a wrong one.
 *
 * TODO(backend): the same field this board keeps asking for, next to `sourceUrl`/`sourceLabel`.
 */
const STORAGE_VERSION = 2;

/** One highlight: the words, and what colour they were painted. */
export type CardMark = { text: string; color: HighlightColor };

/** The highlights on each card, in the order they were made. */
export type CardMarks = Record<string, CardMark[]>;

function storageKey(projectId: string): string {
  return `sprintstart:board-card-marks:${projectId}`;
}

type Stored = { version: number; marks: unknown };

/**
 * One stored mark, in either shape it has been written in.
 *
 * A bare string is what version 1 wrote, before highlights had a colour; it reads as yellow, which
 * is the colour those marks were drawn in. A read rather than a version bump, because bumping would
 * throw away every mark somebody made in order to add a property they did not ask about.
 */
function toMark(value: unknown): CardMark | null {
  if (typeof value === "string") {
    return value.trim().length > 0 ? { text: value, color: DEFAULT_HIGHLIGHT } : null;
  }

  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  // A blank mark would match everywhere, which is worse than not being stored.
  if (typeof raw.text !== "string" || raw.text.trim().length === 0) return null;

  return { text: raw.text, color: toHighlightColor(raw.color) };
}

export function readCardMarks(projectId: string): CardMarks {
  if (!projectId) return {};

  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Stored;
    // Both versions are read; only the shape of an entry changed. See `toMark`.
    if (parsed?.version > STORAGE_VERSION || typeof parsed?.marks !== "object" || !parsed.marks) {
      return {};
    }

    const marks: CardMarks = {};
    for (const [cardId, value] of Object.entries(parsed.marks as Record<string, unknown>)) {
      if (!Array.isArray(value)) continue;

      const list = value.map(toMark).filter((mark): mark is CardMark => mark !== null);
      // A card whose marks were all rubbish is dropped rather than stored as an empty list: storage
      // should hold the marks somebody made, not a row per card saying there are none.
      if (list.length > 0) marks[cardId] = list;
    }

    return marks;
  } catch {
    return {};
  }
}

/** Stores the marks. A storage that refuses is not a reason to lose them on screen. */
export function writeCardMarks(projectId: string, marks: CardMarks): void {
  if (!projectId) return;

  try {
    window.localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({ version: STORAGE_VERSION, marks } satisfies Stored),
    );
  } catch {
    // Nothing to do and nothing to say: the marks still hold for this visit.
  }

  notifyBoardStorageWritten();
}

/**
 * Marks some words, or repaints them when they are already marked.
 *
 * Pressing a second colour on a marked sentence changes its colour rather than adding a second
 * mark over the first. That is what the gesture looks like it does — the swatches are a choice
 * between colours, not four independent switches.
 */
export function setCardMark(
  marks: CardMarks,
  cardId: string,
  selected: string,
  color: HighlightColor,
): CardMarks {
  const text = selected.trim();
  if (!cardId || text.length === 0) return marks;

  const current = marks[cardId] ?? [];
  const existing = current.some((mark) => mark.text === text);

  return {
    ...marks,
    [cardId]: existing
      ? current.map((mark) => (mark.text === text ? { text, color } : mark))
      : [...current, { text, color }],
  };
}

/**
 * Takes the highlight off some words, keeping whatever was marked around them.
 *
 * Selecting the middle of a marked sentence leaves the two ends marked, in the colour they already
 * had — one highlight becomes two. An eraser that only worked on exactly what was marked would be
 * one that mostly refuses, and "mark a paragraph, then decide only the middle clause was the point"
 * is the ordinary way people use a marker pen.
 */
export function removeCardMark(marks: CardMarks, cardId: string, selected: string): CardMarks {
  const text = selected.trim();
  const current = marks[cardId];
  if (!current || text.length === 0) return marks;

  const next: CardMark[] = [];
  for (const mark of current) {
    const at = mark.text.indexOf(text);
    if (at === -1) {
      next.push(mark);
      continue;
    }

    // Both ends, trimmed, and only when something is left of them — the halves of a word are not
    // words, and a highlight over a single space is a stripe nobody put there.
    const before = mark.text.slice(0, at).trim();
    const after = mark.text.slice(at + text.length).trim();
    if (before.length > 0) next.push({ text: before, color: mark.color });
    if (after.length > 0) next.push({ text: after, color: mark.color });
  }

  const updated = { ...marks };
  if (next.length > 0) updated[cardId] = next;
  else delete updated[cardId];

  return updated;
}

/** One card's marks. */
export function marksOf(marks: CardMarks | undefined, cardId: string): CardMark[] {
  return marks?.[cardId] ?? [];
}

/** The colour some words are painted on a card, or null when they are not marked here. */
export function colorOf(marks: CardMark[], selected: string): HighlightColor | null {
  return marks.find((mark) => mark.text === selected.trim())?.color ?? null;
}

/**
 * The mark these words sit inside, or null when they sit outside every one.
 *
 * "Inside" includes "is exactly". What the eraser asks before offering itself, and what a colour
 * press asks before deciding whether it is painting fresh text or repainting part of a highlight.
 */
export function enclosingCardMark(marks: CardMark[], selected: string): CardMark | null {
  const text = selected.trim();
  if (text.length === 0) return null;

  return marks.find((mark) => mark.text.includes(text)) ?? null;
}
