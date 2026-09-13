import { useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { boardService } from "../../../services/boardService";
import { useProjectContext } from "../../projects/useProjectContext";
import { checklistFromTask, type TaskForChecklist } from "../generation/taskChecklist";
import { rememberOrigin } from "../layout/cardOrigins";

type AddTaskToBoardProps = TaskForChecklist & {
  /** The task's page in the tracker, when it has one — this is the way back from the card. */
  url?: string | null;
};

/**
 * Puts a task on the hire's own board as something they can tick off.
 *
 * Sits under the task rather than in the card's header, beside the offer to ask the buddy about it:
 * both are things to do *with* a task you have read, and neither is what the card is for.
 *
 * Deliberately not a claim and deliberately not a status change. Claiming a task aims the hire's
 * whole plan at it and stays behind the mentor's confirm button; this only makes a working copy,
 * which is why it can be a plain button with nothing to confirm. See `generation/taskChecklist.ts`
 * for why the copy never writes back.
 */
export function AddTaskToBoard({ title, summary, url }: AddTaskToBoardProps) {
  const { selectedProjectId } = useProjectContext();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // A hire on no project has no board, and an offer that can only fail is worse than no offer.
  if (!selectedProjectId) return null;

  async function save() {
    if (!selectedProjectId) return;

    const request = checklistFromTask({ title, summary });
    setSaving(true);
    try {
      const card = await boardService.addCard(selectedProjectId, request);

      // Recorded only once the card exists, and never allowed to fail the save — `rememberOrigin`
      // swallows a storage that refuses. A task with no URL gets no trail rather than a dead one.
      if (url) rememberOrigin(selectedProjectId, card.id, { url, label: title });
      setSaved(true);
      toast.success("On your board", {
        description:
          request.kind === "CHECKLIST" && request.items.length > 1
            ? `"${title}" — ${request.items.length} things to tick off.`
            : `"${title}" — yours to break down.`,
      });
    } catch {
      toast.error("That couldn't be added to your board", {
        description: "Nothing changed — try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void save()}
      loading={saving}
      // Not hidden once used, the way `SaveReplyToBoard` is not: a hire who added a task, dismissed
      // the card and wants it back should find the same button where it was.
      icon={<ListPlus className="h-4 w-4" aria-hidden="true" />}
    >
      {saved ? "On your board" : "Add to my board"}
    </Button>
  );
}
