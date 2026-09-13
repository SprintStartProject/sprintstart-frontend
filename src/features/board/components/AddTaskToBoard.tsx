import { ListChecks } from "lucide-react";
import { SaveToBoard } from "../save/SaveToBoard";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { checklistFromTask, taskSteps, type TaskForChecklist } from "../generation/taskChecklist";

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
  /**
   * Whether to ask the mentor for steps when the task states none.
   *
   * Off where the card already asks that question in its own words: two buttons that open the same
   * conversation with the same question is one button too many. `CurrentTaskCard` asks it;
   * `SuggestedTasksCard` asks about claiming instead, so there this is the only way to it.
   */
  offerToAsk?: boolean;
};

/**
 * Turning a task into steps the hire can tick off — by copying them, or by going and getting them.
 *
 * **It does not "add the task to the board" — the task is already there.** That was the first
 * wording and it was wrong in the one place it matters most: on the current-task card, which is on
 * the board by definition, it offered to do something that looked already done. What this makes is
 * a *checklist*, which is the thing the task card cannot be: the task cards are live reads the hire
 * may not touch, and the steps somebody thinks up while reading a task have to go somewhere.
 *
 * **Two tasks, two different offers, and the split is the honest part.** A task that states its
 * steps — checkboxes, acceptance criteria — gets a button that copies them, and every line on the
 * resulting card is a line the hire can find in the task. A task that states none has nothing to
 * copy, and the button that used to appear there produced a checklist of one item named after the
 * task: the title handed back with a checkbox beside it, which teaches a new hire nothing. So that
 * case asks the mentor instead. The steps come back as words the hire reads, and the offer to keep
 * them as a card is already sitting under the reply (`buddy/SaveReplyToBoard`) — so it still ends
 * in a checklist, one press later, and the press is the hire saying those are the steps.
 *
 * Neither is a claim or a status change. Claiming a task aims the hire's whole plan at it and stays
 * behind the mentor's confirm button; this only makes a working copy, which is why it can be a
 * plain button with nothing to confirm.
 */
export function AddTaskToBoard({
  title,
  summary,
  url,
  onAdded,
  offerToAsk = true,
}: AddTaskToBoardProps) {
  const steps = taskSteps({ title, summary });

  if (steps.length === 0) {
    if (!offerToAsk) return null;

    return (
      <AskTheBuddy
        // Asks for a list on purpose: the offer to keep a reply as a card only appears under a
        // reply that holds one, so a question that invites prose ends the trail one step short.
        question={`How do I get started on "${title}"? A short checklist of first steps would help.`}
        label="Ask for the first steps"
      />
    );
  }

  return (
    <SaveToBoard
      request={() => checklistFromTask({ title, summary })}
      origin={() => (url ? { url, label: title } : null)}
      label="Break this into a checklist"
      // No saved label: the card appears on the board the hire is looking at. See `SaveToBoard`.
      onSaved={onAdded}
      icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
      description={`${steps.length} things to tick off.`}
    />
  );
}
