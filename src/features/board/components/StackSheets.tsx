import { SHEET_HOVERED, STACK_SHEETS, type BehindSheet } from "../layout/stackSheets";

type StackSheetsProps = {
  behind: BehindSheet[];
  /** Opens the pile and brings one member into view. Absent when the pile cannot be opened. */
  onRevealMember?: (cardId: string) => void;
};

/**
 * Deepest first, so the nearer sheet paints over it and the two strips stack rather than
 * overlap. Only what is still to do is drawn: three of five ticked off leaves one card
 * behind this one, and drawing two would be the board overstating what is left.
 *
 * Hidden from screen readers and out of the tab order on purpose. This is the pointer
 * shortcut; the chip in the card's header is the control — it says "Step 2 of 5", carries
 * `aria-expanded`, and opening the pile puts every one of these cards on the board in full,
 * so nothing here is the only way to reach anything.
 */
export function StackSheets({ behind, onRevealMember }: StackSheetsProps) {
  return (
    <>
      {behind
        .map((member, depth) => ({ member, depth }))
        .reverse()
        .map(({ member, depth }) => (
          <button
            type="button"
            key={member.id}
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => onRevealMember?.(member.id)}
            className={`pointer-events-none absolute flex origin-top items-end overflow-hidden rounded-2xl border border-app-border bg-app-surface pb-1 text-left shadow-sm transition-all duration-300 ease-out group-hover/stack:pointer-events-auto group-hover/stack:shadow-lg ${STACK_SHEETS[depth].tone} ${STACK_SHEETS[depth].box} ${SHEET_HOVERED}`}
          >
            {/* Faded in rather than always there: at rest the strip is a few pixels of card edge,
                and a title clipped to three of its letters is worse than no title. */}
            <span className="flex w-full min-w-0 items-center gap-1.5 px-4 text-xs font-medium text-app-text-muted opacity-0 transition-opacity duration-200 group-hover/stack:text-app-brand-text group-hover/stack:opacity-100">
              <member.Icon
                className={`h-3.5 w-3.5 shrink-0 ${member.accent.icon}`}
                aria-hidden="true"
              />
              <span className="truncate">{member.name}</span>
            </span>
          </button>
        ))}
    </>
  );
}
