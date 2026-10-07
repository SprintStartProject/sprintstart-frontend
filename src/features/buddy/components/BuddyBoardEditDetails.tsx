import type { HireActionProposal } from "../types";
import {
  BUDDY_ACTION_DISMISS_CARDS,
  BUDDY_ACTION_EDIT_LINK,
  BUDDY_ACTION_PLACE_LINK,
  BUDDY_ACTION_REORDER_CARDS,
} from "../types";

type BuddyBoardEditDetailsProps = {
  action: HireActionProposal;
};

/**
 * What a board edit would change, beyond the words `BuddyActionProposals` already draws for
 * checklists and notes: the link a card would hold, or the cards a clean-up or rearrangement names.
 *
 * The card names come from the backend, resolved from the ids the confirm will act on — never
 * from the model's reply — so the list here is exactly what agreeing would touch.
 *
 * The link is text, not an anchor. It is a proposal: the hire is being asked whether to keep it,
 * and a click on the offer should never be what opens an address the model wrote.
 */
export function BuddyBoardEditDetails({ action }: BuddyBoardEditDetailsProps) {
  const isLink =
    action.action === BUDDY_ACTION_PLACE_LINK || action.action === BUDDY_ACTION_EDIT_LINK;
  const isReorder = action.action === BUDDY_ACTION_REORDER_CARDS;
  const isDismissal = action.action === BUDDY_ACTION_DISMISS_CARDS;

  if (isLink && action.linkUrl) {
    return (
      <div className="min-w-0 text-xs" data-testid="buddy-proposal-link">
        {action.linkLabel && (
          <p className="text-sm font-medium break-words text-app-text">{action.linkLabel}</p>
        )}
        <p className="break-all text-app-text-muted">{action.linkUrl}</p>
      </div>
    );
  }

  const names = action.cardNames ?? [];
  if ((isReorder || isDismissal) && names.length > 0) {
    // Numbered for a new order, because the order is the change; bulleted for a clean-up, where
    // it is only which cards.
    const List = isReorder ? "ol" : "ul";
    return (
      <div className="min-w-0" data-testid="buddy-proposal-cards">
        <p className="text-xs text-app-text-muted">
          {isReorder ? "First on your board, in this order:" : "Would come off your board:"}
        </p>
        <List
          className={`mt-1 space-y-0.5 text-xs text-app-text-muted ${isReorder ? "list-decimal pl-5" : ""}`}
        >
          {names.map((name, index) => (
            <li key={`${action.id}-${index}`} className="break-words">
              {isReorder ? name : `· ${name}`}
            </li>
          ))}
        </List>
      </div>
    );
  }

  return null;
}
