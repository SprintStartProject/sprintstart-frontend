import { Eye } from "lucide-react";

type BoardViewStatusProps = {
  /** How many cards are on screen. */
  shown: number;
  /** How many the board is holding, whatever the current view. */
  total: number;
  /**
   * The cuts currently in force, in the order they are applied, each named the way the control
   * that set it names it. Empty when nothing is cutting anything, which is when this says nothing.
   */
  cuts: string[];
  /** Undoes every cut at once. */
  onShowEverything: () => void;
};

/**
 * One line saying how much of the board is on screen, and why.
 *
 * The board can take cards away in four independent ways — the section tabs, the source filter, the
 * focus view, and a folded sequence — and each of them is defensible on its own. Together they were
 * the whole complaint: a hire looking at six cards out of thirty-four could not tell which control
 * had eaten the other twenty-eight, so the board read as unreliable rather than as filtered. Three
 * of the four controls are also somewhere else on the page, which does not help, because knowing
 * where a control *is* is not the same as noticing that it is *on*.
 *
 * So the state is stated. Every cut in force is named here, in one place, in the same words its
 * control uses, and the way out is the last thing on the line — one click that clears all four at
 * once rather than four controls to find and reset in turn.
 *
 * **Only when something is actually hidden.** A line that said "showing 12 of 12" on every visit
 * would be one more thing to read on a page whose problem is that there is too much to read.
 */
export function BoardViewStatus({ shown, total, cuts, onShowEverything }: BoardViewStatusProps) {
  if (total <= shown) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-app-text-muted">
      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />

      <span className="tabular-nums">
        Showing {shown} of {total} cards
      </span>

      {/* The reasons, not just the number. "6 of 34" tells a hire that something is missing; naming
          the cuts tells them which control to reach for — or, more often, that they never meant to
          set one of them at all. */}
      {cuts.map((cut) => (
        <span key={cut} className="before:mr-2 before:content-['·']">
          {cut}
        </span>
      ))}

      <button
        type="button"
        onClick={onShowEverything}
        className="font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        Show everything
      </button>
    </p>
  );
}
