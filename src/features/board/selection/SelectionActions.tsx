import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { useProjectContext } from "../../projects/useProjectContext";
import { boardService } from "../../../services/boardService";
import { cardFor } from "./selectionCapture";
import { useTextSelection } from "./useTextSelection";

/** How far above the selection the toolbar floats, in pixels. */
const OFFSET = 8;

/** Roughly the toolbar's own height, used to decide whether it fits above the selection. */
const TOOLBAR_HEIGHT = 44;

/**
 * Offers to keep whatever the hire has just highlighted, from anywhere in the app.
 *
 * Mounted once beside the buddy dock rather than per page, for the same reason: something worth
 * keeping is almost never found on the board itself. It is found in the knowledge base, in a chat
 * answer, in an onboarding step — and the cost of keeping it has to be lower than the cost of
 * remembering to come back for it, or nobody does.
 *
 * Deliberately does not navigate. Being pulled to `/board` to confirm something landed is exactly
 * the interruption this exists to avoid; the toast carries the way there for whoever wants it.
 */
export function SelectionActions() {
  const { selection, clear } = useTextSelection();
  const { selectedProjectId } = useProjectContext();
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const add = useCallback(async () => {
    if (!selection || !selectedProjectId) return;

    const request = cardFor(selection);
    setSaving(true);
    try {
      await boardService.addCard(selectedProjectId, request);
      toast.success(
        request.kind === "LINK" ? "Link saved to your board" : "Note saved to your board",
        {
          action: { label: "View board", onClick: () => void navigate("/board") },
        },
      );
      clear();
    } catch {
      // Kept on screen on failure: the selection is still there, and so is the offer to retry.
      toast.error("Could not save that to your board");
    } finally {
      setSaving(false);
    }
  }, [selection, selectedProjectId, toast, navigate, clear]);

  // Nothing to keep, or nowhere to keep it. A hire on no project has no board, and an offer that
  // can only fail is worse than no offer.
  if (!selection || !selectedProjectId) return null;

  const { rect } = selection;
  const fitsAbove = rect.top > TOOLBAR_HEIGHT + OFFSET;
  const top = fitsAbove ? rect.top - OFFSET : rect.bottom + OFFSET;

  return (
    <div
      role="toolbar"
      aria-label="Actions for the selected text"
      // Pressing a mouse button outside a selection collapses it, which would take the selection
      // away on mousedown — before the click that needs it has finished. Suppressing the default
      // keeps the highlight alive through the press. Tab-focus is unaffected: it is not a mousedown.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-50 rounded-lg border border-app-border bg-app-surface p-1 shadow-lg"
      style={{
        left: rect.left + rect.width / 2,
        top,
        transform: `translateX(-50%) ${fitsAbove ? "translateY(-100%)" : ""}`,
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => void add()}
        loading={saving}
        icon={<BookmarkPlus className="h-4 w-4" />}
      >
        Add to board
      </Button>
    </div>
  );
}
