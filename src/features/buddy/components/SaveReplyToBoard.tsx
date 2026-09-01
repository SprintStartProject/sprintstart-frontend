import { useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { boardService } from "../../../services/boardService";
import { extractChecklist, toChecklistRequest } from "../../board/generation/checklistFromMarkdown";
import { useProjectContext } from "../../projects/useProjectContext";

type SaveReplyToBoardProps = {
  /** The buddy's reply, as Markdown. Nothing renders when it holds no list. */
  content: string;
};

/**
 * Keeps a to-do list the buddy just wrote, as a card on the board.
 *
 * The conversation is deliberately not durable — every visit opens fresh, and the previous window
 * survives only as the mentor's memory of it. That is right for a conversation and wrong for a
 * list: a hire who was told six things to do this morning should not have to remember them or
 * scroll for them, and "ask the buddy again" produces a *different* six things.
 *
 * So the offer appears exactly where the list is, and only where there is one. The card is built
 * from the reply's own lines, so what lands on the board is what the hire read here — and once it
 * is there it is theirs: they tick it, edit it, re-order it, and the buddy never touches it again.
 *
 * Rendered under the buddy's replies and never under the hire's own messages: a hire's question is
 * not a list, and a button under every message is a button under nothing.
 */
export function SaveReplyToBoard({ content }: SaveReplyToBoardProps) {
  const { selectedProjectId } = useProjectContext();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const checklist = extractChecklist(content);
  if (!checklist || !selectedProjectId) return null;

  async function save() {
    // Narrowed above; repeated for the closure, which TypeScript cannot carry the check into.
    if (!checklist || !selectedProjectId) return;

    setSaving(true);
    try {
      await boardService.addCard(selectedProjectId, toChecklistRequest(checklist));
      setSaved(true);
      toast.success("Kept on your board", {
        description: `"${checklist.title}" — ${checklist.items.length} things to tick off.`,
      });
    } catch {
      toast.error("That list couldn't be kept", { description: "Nothing changed — try again." });
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
      // Not hidden once used. A hire who keeps a list, dismisses it and wants it back should find
      // the same button where it was, rather than having to make the buddy say it again.
      icon={<ListPlus className="h-4 w-4" aria-hidden="true" />}
    >
      {saved ? "On your board" : "Keep this on my board"}
    </Button>
  );
}
