/**
 * Turning a task the hire is looking at into a list on their board that is theirs.
 *
 * The board's task cards — `CURRENT_TASK`, `SUGGESTED_TASKS` — are AI-owned reads: they are
 * re-read from the tracker on every board load, and the hire may not touch them. That is right for
 * what they are, and it leaves a hire who wants to break a task into steps with nowhere to put the
 * steps. Bending the task card into something editable would have made a live read pretend to be a
 * working copy, so this mints a `HIRE`-owned `CHECKLIST` beside it instead.
 *
 * **The card is a working copy and never the source of truth.** Ticking a line here says nothing
 * to the tracker, by design: a checklist that half-wrote task state would be a second place the
 * task's status lives, and the hire would have no way of knowing which one anybody else is
 * reading. What the card carries back to the task is a link — see `layout/cardOrigins.ts`.
 */

import { listItemsIn } from "./checklistFromMarkdown";
import type { AuthoredCardRequest } from "../types";

/** The parts of a task this needs, so a suggested task and a claimed one can both be passed in. */
export type TaskForChecklist = {
  title: string;
  /** The task's body, when the board carries one. `SUGGESTED_TASKS` carries none. */
  summary?: string | null;
};

/**
 * How many lines a task may contribute before the card stops being a card.
 *
 * Matches the cap the buddy's lists get: past two dozen items a checklist is a document, and
 * `ChecklistCard` is already folding everything after the sixth line behind a count.
 */
export const MAX_TASK_ITEMS = 25;

/**
 * The checklist a task becomes.
 *
 * Two branches, and the second one is not a failure case. A task written with checkboxes or
 * acceptance criteria already says what its steps are, and those lines become the items verbatim —
 * nothing here asks a model anything, so every line on the card is a line the hire can find in the
 * task. A task with no structure at all becomes a single item named after the task, which is worth
 * more than nothing: it is a thing on their board they can tick off, which is what they asked for.
 *
 * The title is the task's, never a lead taken from the body. A hire scanning their board is looking
 * for the task they know the name of.
 */
export function checklistFromTask(task: TaskForChecklist): AuthoredCardRequest {
  const title = task.title.trim();
  const structured = listItemsIn(task.summary ?? "").slice(0, MAX_TASK_ITEMS);
  const items = structured.length > 0 ? structured : [title];

  return {
    kind: "CHECKLIST",
    title,
    items: items.map((text) => ({ text, done: false })),
  };
}
