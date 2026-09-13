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
 *
 * **And it is only offered for a task that already says what its steps are.** The first version
 * fell back to a one-line checklist named after the task, on the reasoning that something tickable
 * beats nothing. It does not: a new hire looking at *"Fix the login redirect"* with a checkbox
 * beside it has been handed the title back and learned nothing. That is not a gap this module can
 * close, because closing it means *writing steps somebody has to be right about* — and nothing
 * here asks a model anything, which is exactly what makes every line on the card a line the hire
 * can find in the task.
 *
 * The steps for a task that carries none are the mentor's to write, in the conversation, where the
 * hire reads them before they become a card: ask, read the answer, keep it (`AskTheBuddy` →
 * `buddy/SaveReplyToBoard`). One press more, and the press is the hire agreeing that those are the
 * steps. See the `place_checklist` note in `checklistFromMarkdown.ts` for what would make it one
 * press, and why that is a thing to be careful with rather than an oversight.
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
 * The steps a task already states, in the order it states them. Empty when it states none.
 *
 * Checklist items and acceptance criteria both, because a task that separates them is a task whose
 * steps are in two places — see `listItemsIn`. What comes back is verbatim apart from markdown
 * syntax: nothing is summarised, ordered or invented.
 *
 * The predicate as much as the content. A caller asks this first to find out whether there is a
 * checklist to offer at all, which is the whole of the no-structure branch: there isn't one.
 */
export function taskSteps(task: TaskForChecklist): string[] {
  return listItemsIn(task.summary ?? "").slice(0, MAX_TASK_ITEMS);
}

/**
 * The checklist a task becomes.
 *
 * Only meaningful for a task with {@link taskSteps} — a task that states none has nothing to break
 * down, and this returns null rather than inventing a card out of its own title. Callers use that
 * null to offer the conversation instead.
 *
 * The title is the task's, never a lead taken from the body. A hire scanning their board is looking
 * for the task they know the name of.
 */
export function checklistFromTask(task: TaskForChecklist): AuthoredCardRequest | null {
  const steps = taskSteps(task);
  if (steps.length === 0) return null;

  return {
    kind: "CHECKLIST",
    title: task.title.trim(),
    items: steps.map((text) => ({ text, done: false })),
  };
}
