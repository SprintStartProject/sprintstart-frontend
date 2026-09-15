import { ExternalLink, Link2 } from "lucide-react";
import { BoardCardFrame } from "./BoardCardFrame";
import { CardOriginLink } from "./CardOriginLink";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { questionAboutLink } from "../generation/cardQuestion";
import type { CardOrigin } from "../layout/cardOrigins";
import type { BoardCard, LinkContent } from "../types";

type LinkCardProps = {
  content: LinkContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  /**
   * Where the hire was when they kept this link — which is not where the link goes.
   *
   * The two are worth keeping apart: the address is the thing itself, and the origin is the page
   * that mentioned it. A link picked out of an onboarding step is often only useful next to the
   * step that explained why it mattered.
   */
  origin?: CardOrigin | null;
};

/**
 * A link the hire kept.
 *
 * With no label it shows the URL — worse to read, but always true. Deriving a title from the
 * address would be the board inventing a name for something the hire chose not to name, and the one
 * rule this feature holds everywhere is that the board does not make things up.
 *
 * No inline editing: a link is its address, and changing that makes it a different link. Remove and
 * add is the honest gesture, and it is one click more than an edit form nobody would find.
 */
export function LinkCard({ content, card, onDismiss, dismissing, origin }: LinkCardProps) {
  return (
    <BoardCardFrame
      icon={Link2}
      title="Link"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      <a
        href={content.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-start gap-1.5 text-sm font-medium text-app-brand-text hover:underline"
      >
        <span className="break-all">{content.label ?? content.url}</span>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </a>
      {content.label && <p className="mt-1 text-xs break-all text-app-text-muted">{content.url}</p>}
      <CardOriginLink origin={origin ?? null} />
      <AskTheBuddy question={questionAboutLink(content.label, content.url)} />
    </BoardCardFrame>
  );
}
