import { Check } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { Button } from "./Button";

type SaveButtonProps = {
  /** Whether there are unsaved changes. Drives the enabled/highlighted look. */
  dirty: boolean;
  /** Whether a save is in flight. Shows the spinner and the saving label. */
  saving: boolean;
  /** Label shown when there are unsaved changes. */
  label?: string;
  /** Label shown while saving. */
  savingLabel?: string;
  /** Label shown when there is nothing to save (muted state). */
  cleanLabel?: string;
  /**
   * Extra disable reason beyond clean/saving (e.g. an invalid form). The button
   * is disabled when clean, saving, or this is true.
   */
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children" | "className"> & {
    className?: string;
  };

/**
 * The app's single Save affordance. It always reflects whether there are unsaved
 * changes so the state is never a guess: muted + disabled when clean, brand +
 * enabled the moment something is edited, and a spinner + "Saving…" while the
 * save is in flight. State is conveyed by icon **and** label, never color alone
 * (AGENTS.md §7), and it keeps a visible focus ring in both themes.
 *
 * On a successful save the caller resets `dirty` to false, which returns the
 * button to the muted "no unsaved changes" look.
 */
export function SaveButton({
  dirty,
  saving,
  label = "Save changes",
  savingLabel = "Saving…",
  cleanLabel = "Saved",
  disabled = false,
  className = "",
  type = "button",
  ...rest
}: SaveButtonProps) {
  return (
    <Button
      variant={dirty && !saving ? "primary" : "secondary"}
      type={type}
      disabled={!dirty || disabled}
      loading={saving}
      icon={<Check className="h-4 w-4" aria-hidden="true" />}
      className={className}
      {...rest}
    >
      {saving ? savingLabel : dirty ? label : cleanLabel}
    </Button>
  );
}
