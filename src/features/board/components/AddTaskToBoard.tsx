import { ListChecks } from "lucide-react";
import { SaveToBoard } from "../save/SaveToBoard";
import { checklistFromTask, type TaskForChecklist } from "../generation/taskChecklist";

type AddTaskToBoardProps = TaskForChecklist & {
  /** The task's page in the tracker, when it has one — this is the way back from the card. */
  url?: string | null;
  /**
   * Told once the checklist is really on the board, so the board can re-read itself.
   *
   * Absent nowhere in practice — this only ever renders on a board card — but optional, because a
   * task card shown outside the board (a test, a story) has no board to refresh.
   */
  onAdded?: () => void;
};

/**
 * Breaks a task into a list on the hire's own board.
 *
 * Sits under the task, beside the offer to ask the buddy about it: both are things to do *with* a
 * task you have read, and neither is what the card is for.
 *
 * **It does not "add the task to the board" — the task is already there.** That was the first
 * wording and it was wrong in the one place it matters most: on the *current task* card, which is
 * on the board by definition, it offered to do something that looked already done. What this makes
 * is a *checklist*, which is the thing the task card cannot be: the task cards are live reads the
 * hire may not touch, and the steps somebody thinks up while reading a task have to go somewhere.
 * So the button says what it makes.
 *
 * Deliberately not a claim and not a status change. Claiming a task aims the hire's whole plan at
 * it and stays behind the mentor's confirm button; this only makes a working copy, which is why it
 * can be a plain button with nothing to confirm. See `generation/taskChecklist.ts` for why the copy
 * never writes back.
 */
export function AddTaskToBoard({ title, summary, url, onAdded }: AddTaskToBoardProps) {
  const request = () => checklistFromTask({ title, summary });

  return (
    <SaveToBoard
      request={request}
      origin={() => (url ? { url, label: title } : null)}
      label="Break this into a checklist"
      // No saved label: the card appears on the board the hire is looking at. See `SaveToBoard`.
      onSaved={onAdded}
      icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
      description={describe(request())}
    />
  );
}

/** The toast's second line: what exactly landed, since the card may be below the fold. */
function describe(request: ReturnType<typeof checklistFromTask>): string {
  const items = request.kind === "CHECKLIST" ? request.items.length : 0;

  return items > 1 ? `${items} things to tick off.` : "Yours to break down.";
}
