import { useState, type ReactNode } from "react";

import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../context/useToast";
import { boardService } from "../../../services/boardService";
import { useProjectContext } from "../../projects/useProjectContext";
import { rememberOrigin, type CardOrigin } from "../layout/cardOrigins";
import type { AuthoredCardRequest } from "../types";

type SaveToBoardProps = {
  /**
   * The card to make, built when the button is pressed rather than when it is drawn.
   *
   * Lazy because most of these sit under a message in a list: building a card for every answer in a
   * long chat, on every render, to draw a button nobody has clicked is work for nothing. Returning
   * null means "there turned out to be nothing here", and the press does nothing rather than
   * putting an empty card on the board.
   */
  request: () => AuthoredCardRequest | null;
  /** Where this came from, recorded beside the card. See `layout/cardOrigins.ts`. */
  origin?: () => CardOrigin | null;
  label: string;
  /** What the button says afterwards. It stays pressable — see below. */
  savedLabel: string;
  icon: ReactNode;
  /** The second line of the toast: what exactly landed on the board. */
  description?: string;
  iconOnly?: boolean;
  className?: string;
};

/**
 * The one button that puts something on the board, wherever that something is found.
 *
 * There are four places now — a highlighted paragraph, a chat answer, a chat as a whole, a buddy
 * reply — and they were going to be four buttons that each did the same four things slightly
 * differently: find the project, call the same endpoint, decide what the toast says, decide whether
 * to remember where it came from. The differences that matter are all in *what card to make*, which
 * is the one thing this takes as an argument.
 *
 * **It does not navigate.** Being pulled to the board to confirm something landed is the
 * interruption this exists to avoid; the toast carries the way there for whoever wants it.
 *
 * **It stays pressable after a save.** A hire who keeps something, dismisses it from the board and
 * wants it back should find the same button where it was, rather than having to make the
 * conversation say it again. The label changes so the first press is acknowledged; the button does
 * not go away, and it is never disabled.
 */
export function SaveToBoard({
  request,
  origin,
  label,
  savedLabel,
  icon,
  description,
  iconOnly = false,
  className = "",
}: SaveToBoardProps) {
  const { selectedProjectId } = useProjectContext();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // No project means no board, and an offer that can only fail is worse than no offer.
  if (!selectedProjectId) return null;

  async function save() {
    const card = request();
    if (!card || !selectedProjectId) return;

    setSaving(true);
    try {
      const created = await boardService.addCard(selectedProjectId, card);

      const where = origin?.();
      // Never allowed to fail the save: the card is what was asked for, the trail back is extra.
      if (where) rememberOrigin(selectedProjectId, created.id, where);

      setSaved(true);
      toast.success("Kept on your board", { description });
    } catch {
      toast.error("That couldn't be kept", { description: "Nothing changed — try again." });
    } finally {
      setSaving(false);
    }
  }

  const text = saved ? savedLabel : label;

  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly={iconOnly}
      className={className}
      loading={saving}
      onClick={() => void save()}
      aria-label={iconOnly ? text : undefined}
      title={iconOnly ? text : undefined}
      icon={iconOnly ? undefined : icon}
    >
      {iconOnly ? icon : text}
    </Button>
  );
}
