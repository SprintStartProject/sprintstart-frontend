import { CornerUpLeft } from "lucide-react";

import type { CardOrigin } from "../layout/cardOrigins";

type CardOriginLinkProps = {
  origin: CardOrigin | null;
};

/**
 * The way back to wherever a card came from.
 *
 * A quiet line at the foot of the card rather than an action in its header: this is provenance, and
 * provenance is something you read when you are already wondering, not something the card should
 * offer you before you have read what it says.
 *
 * **A plain anchor, not a router link, and that is deliberate.** The href carries a `#:~:text=`
 * fragment naming the words the hire selected, and the browser only applies one on a real
 * navigation — a client-side route change lands on the page and scrolls nowhere. So this costs a
 * full page load, which is the price of arriving at the paragraph instead of at the top of it. On a
 * board card, which is not a thing anybody clicks through in a hurry, that is the right trade.
 *
 * Renders nothing when there is no origin. Most cards have none: the live cards were never "found"
 * anywhere, and a note typed straight into the board came from the board.
 */
export function CardOriginLink({ origin }: CardOriginLinkProps) {
  if (!origin) return null;

  return (
    <a
      href={origin.url}
      className="mt-3 inline-flex max-w-full items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text hover:underline"
    >
      <CornerUpLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {/* "Back to", not "From". A note made out of a selection already carries `From <place>` as the
          last line of its own text — that line is the durable one, written into the card itself and
          still there on a machine that never saw this browser's storage. Repeating the same three
          words directly under it made the card stutter. These say what the link *does*, which is
          the one thing the sentence above it cannot. */}
      <span className="truncate">Back to {origin.label}</span>
    </a>
  );
}
