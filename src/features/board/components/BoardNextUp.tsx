import { ArrowRight } from "lucide-react";

import type { NextUp } from "../layout/nextUp";

type BoardNextUpProps = {
  next: NextUp | null;
};

/**
 * One line, above everything: start here.
 *
 * The complaint this whole feature came from was forty cards at the same volume. Stages, areas,
 * sequences and a focus section each answer it by showing *fewer* cards — which is right, and still
 * leaves a list to choose from. This is the only part of the board that answers with one thing.
 *
 * It says what finishing it would let through, when finishing it would let anything through, and
 * that number is the reason to believe the line: "three cards are waiting on this" is a fact about
 * the sequences the hire and their PM built, not the board being encouraging.
 *
 * Clicking it scrolls the card into view rather than filtering to it. Filtering would answer "where
 * do I start" by hiding everything else, which is a second thing to undo; scrolling leaves the board
 * exactly as it was and puts the card in front of them.
 *
 * A link in prose rather than a card of its own. A card would compete with the cards it is pointing
 * at, and this is a caption, not a thing on the board.
 */
export function BoardNextUp({ next }: BoardNextUpProps) {
  if (!next) return null;

  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-app-text-muted">
      <span>Start with</span>
      <button
        type="button"
        onClick={() => {
          document
            .querySelector(`[data-card-id="${CSS.escape(next.card.id)}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="inline-flex items-center gap-1 font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        {next.name}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {next.unblocks > 0 && (
        <span>
          — {next.unblocks} {next.unblocks === 1 ? "card is" : "cards are"} waiting on it
        </span>
      )}
    </p>
  );
}
