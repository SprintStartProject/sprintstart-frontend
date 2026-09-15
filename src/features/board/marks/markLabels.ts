import { HIGHLIGHT_COLORS, HIGHLIGHT_LABEL, type HighlightColor } from "./highlightColors";
import { notifyBoardStorageWritten } from "../layout/boardStorage";

/**
 * What this hire's highlight colours mean, in their words.
 *
 * The four colours are deliberately meaningless — "colour is never the message" is a rule this app
 * holds everywhere, and a sentence marked green does not mean it went well. But a hire sorting a
 * board *does* mean something by them, and after a week they have forgotten which. So the meaning is
 * theirs to write down, which is the only way to have both: the design system keeps its rule
 * because nothing here assigns a meaning, and the board gets one because the person did.
 *
 * Local storage, per project, and part of the arrangement that syncs — a legend that did not follow
 * the hire to another machine would be a legend for somebody else's board.
 */
const STORAGE_VERSION = 1;

export type MarkLabels = Partial<Record<HighlightColor, string>>;

function storageKey(projectId: string): string {
  return `sprintstart:board-mark-labels:${projectId}`;
}

type Stored = { version: number; labels: unknown };

export function readMarkLabels(projectId: string): MarkLabels {
  if (!projectId) return {};

  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Stored;
    if (
      parsed?.version !== STORAGE_VERSION ||
      typeof parsed.labels !== "object" ||
      !parsed.labels
    ) {
      return {};
    }

    const labels: MarkLabels = {};
    for (const color of HIGHLIGHT_COLORS) {
      const value = (parsed.labels as Record<string, unknown>)[color];
      // A blank name is not a name. Storing one would leave a colour that looks named and reads as
      // nothing, which is worse than the colour's own word.
      if (typeof value === "string" && value.trim().length > 0) labels[color] = value.trim();
    }

    return labels;
  } catch {
    return {};
  }
}

export function writeMarkLabels(projectId: string, labels: MarkLabels): void {
  if (!projectId) return;

  try {
    window.localStorage.setItem(
      storageKey(projectId),
      JSON.stringify({ version: STORAGE_VERSION, labels } satisfies Stored),
    );
  } catch {
    // Nothing to do and nothing to say: the names still hold for this visit.
  }

  notifyBoardStorageWritten();
}

/**
 * Names a colour, or takes the name off again when it is cleared.
 *
 * Clearing restores the colour's own word rather than leaving it blank — see {@link labelFor}.
 */
export function setMarkLabel(labels: MarkLabels, color: HighlightColor, name: string): MarkLabels {
  const trimmed = name.trim();
  const next = { ...labels };

  if (trimmed.length > 0) next[color] = trimmed;
  else delete next[color];

  return next;
}

/**
 * What to call a colour: the hire's word for it, or the colour's own.
 *
 * Never blank, and never "unnamed". A control labelled "Yellow" is honest and usable on a board
 * nobody has bothered to name; a control labelled "unnamed" is the app pointing at a job the hire
 * did not ask for.
 */
export function labelFor(labels: MarkLabels, color: HighlightColor): string {
  return labels[color] ?? HIGHLIGHT_LABEL[color];
}

/** Whether the hire has named any of them — what decides if a legend is worth drawing. */
export function hasNames(labels: MarkLabels): boolean {
  return HIGHLIGHT_COLORS.some((color) => labels[color] !== undefined);
}
