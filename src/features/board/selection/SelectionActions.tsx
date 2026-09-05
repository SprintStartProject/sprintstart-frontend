import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookmarkPlus, Eraser, Highlighter, LayoutTemplate } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { useProjectContext } from "../../projects/useProjectContext";
import { boardService } from "../../../services/boardService";
import { rememberOrigin } from "../layout/cardOrigins";
import { useCardMarks } from "../marks/useCardMarks";
import { DEFAULT_HIGHLIGHT } from "../marks/highlightColors";
import { cardFor } from "./selectionCapture";
import { useTextSelection } from "./useTextSelection";
import { useAuth } from "../../../context/useAuth";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { blueprintFromSelection } from "../../card-blueprints/generation/blueprintFromSelection";

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
  const { selectedProjectId, canManageSelected } = useProjectContext();
  const { profile } = useAuth();
  const { canMark, colorAt, enclosingColorAt, mark, unmark } = useCardMarks();
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const add = useCallback(async () => {
    if (!selection || !selectedProjectId) return;

    const request = cardFor(selection);
    setSaving(true);
    try {
      const card = await boardService.addCard(selectedProjectId, request);

      // Recorded only once the card exists, and never allowed to fail the save: the card is what
      // the hire asked for and the trail back is the extra. `rememberOrigin` swallows a storage
      // that refuses, so this cannot throw past the toast below.
      rememberOrigin(selectedProjectId, card.id, {
        url: selection.origin,
        label: selection.source ?? "where you were",
      });
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

  /**
   * Whether this selection is text on a card the board is already holding.
   *
   * The two offers are exclusive, and that is the point. Text found out in the app is worth
   * *keeping*; text on a card is already kept, and making a second card out of the first one is a
   * copy nobody asked for. What a hire wants there is the marker pen.
   */
  const marking = canMark && selection.cardId !== null;

  /**
   * Whether this person could turn what they highlighted into a card every new hire starts with.
   *
   * Asked as "may they open the blueprints page", through the same policy the router guards it
   * with, rather than by checking a permission group here. Two places deciding who is a manager is
   * how one of them ends up offering an action the other refuses.
   *
   * Never inside a card: a blueprint is written from what the *project* knows, and a card on
   * somebody's own board is the output of that, not an input to it.
   */
  const canBlueprint = !marking && canAccessRoute(profile, "/card-blueprints", canManageSelected);

  /**
   * The colour these words already carry, or null when they carry none.
   *
   * Drives both halves of what the toolbar offers: which swatch reads as pressed, and whether
   * there is anything to rub out. Asked of the *selection* rather than of the card, because "does
   * this card have marks" is not a question anybody can act on.
   */
  const marked = marking && selection.cardId ? colorAt(selection.cardId, selection.text) : null;

  /**
   * Whether there is a highlight here at all — this selection, or a larger one containing it.
   *
   * What decides whether the eraser is offered, and it is the looser question on purpose. Somebody
   * who marked a paragraph and now wants three words of it back has selected something that is not
   * itself a highlight, and an eraser that appeared only on an exact match would be an eraser that
   * appeared almost never.
   */
  const erasable =
    marking && selection.cardId
      ? enclosingColorAt(selection.cardId, selection.text) !== null
      : false;

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
      {marking ? (
        // One press to mark, and nothing to decide first.
        //
        // This was four colour swatches for a while, and they were in the wrong place. The reason
        // somebody reaches for a marker is that a sentence matters; *which colour* is a thought
        // that comes later, if it comes at all — so putting the palette in front of the gesture put
        // a decision where there was only an impulse. The colours now live on the highlight itself
        // (`MarkPopover`): mark first, click it afterwards if it should be green.
        //
        // The eraser stays here, because it is the only thing that can rub out *part* of a
        // highlight — that needs a selection, and a selection is exactly what this toolbar has.
        <div className="flex items-center gap-1">
          {/* Not offered on something that is already exactly a highlight: there is nothing for it
              to do there but reset a colour somebody chose, and the way to change that colour is to
              click the highlight. Selecting *part* of one still offers it — that marks the part. */}
          {marked === null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                // Non-null by construction: `marking` is false without a card id.
                if (selection.cardId) mark(selection.cardId, selection.text, DEFAULT_HIGHLIGHT);
                clear();
              }}
              icon={<Highlighter className="h-4 w-4" />}
            >
              Highlight
            </Button>
          )}

          {erasable && (
            <>
              {marked === null && (
                <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-app-border" />
              )}
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                aria-label={marked ? "Remove this highlight" : "Remove the highlight here"}
                title={marked ? "Remove this highlight" : "Remove the highlight here"}
                onClick={() => {
                  if (selection.cardId) unmark(selection.cardId, selection.text);
                  clear();
                }}
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void add()}
            loading={saving}
            icon={<BookmarkPlus className="h-4 w-4" />}
          >
            Add to board
          </Button>

          {canBlueprint && (
            <>
              <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-app-border" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Opened for editing, never saved from here. A blueprint applies to every hire
                  // its roles match, and minting one from a highlight would be the app deciding
                  // something about people who are not here yet — see `blueprintFromSelection`.
                  void navigate("/card-blueprints", {
                    state: { draft: blueprintFromSelection(selection.text, selection.source) },
                  });
                  clear();
                }}
                icon={<LayoutTemplate className="h-4 w-4" />}
              >
                Make a blueprint
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
