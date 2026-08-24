import type { ReactNode } from "react";
import { Bot, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import type { BoardCard } from "../types";

type BoardCardFrameProps = {
  title: string;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  /** Optional one-line note under the title, e.g. what the card is counting. */
  subtitle?: string;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  /** A kind-specific control in the header, e.g. "edit this note". */
  action?: ReactNode;
  /** Moves the card one place. Absent at the ends of the board. */
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
};

/**
 * The shell every card renders inside: title, attribution, controls, body.
 *
 * Attribution is decided by `placedAt` alone. A card the buddy placed says so; a card the board
 * keeps as part of the baseline says that instead; a card the hire wrote claims nothing, because
 * they know they wrote it. Claiming the buddy added something it didn't would be attribution the
 * hire cannot check, and attribution they cannot check is attribution they cannot trust — which
 * would undermine the label everywhere it *is* true.
 *
 * The remove control says "Remove", not "Hide": the buddy will not put it back, and a word that
 * suggested otherwise would misdescribe a decision as a gesture.
 *
 * Move up/down are buttons, not only a drag. Dragging is the nicer gesture and it is there too,
 * but a board you can only arrange with a mouse is a board some people cannot arrange at all.
 *
 * Attribution is a `Badge` and every control is a `Button`, so the header picks up the app's one
 * pill and its one icon-button treatment — focus ring, press motion, disabled state and touch
 * target included — instead of re-deriving them here.
 *
 * The surface itself is a `SpotlightCard`, the same card the pool, the source list and the
 * dashboard widgets sit on — so a board card answers to the cursor exactly like every other card
 * in the app, and the tilt follows the user's own setting rather than this feature's opinion.
 */
export function BoardCardFrame({
  title,
  card,
  subtitle,
  onDismiss,
  dismissing = false,
  action,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  children,
}: BoardCardFrameProps) {
  const placedByBuddy = card.placedAt !== null;

  return (
    <SpotlightCard roundedClassName="rounded-2xl" className="h-full">
      <section className="flex h-full flex-col p-4">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-app-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-app-text-muted">{subtitle}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {card.owner === "AI" && (
              <Badge
                variant="brand"
                size="sm"
                className="gap-1"
                title={
                  placedByBuddy
                    ? "Your buddy put this here — it reads your onboarding live"
                    : "Kept up to date for you — this card reads your onboarding live"
                }
              >
                <Bot className="h-3 w-3" aria-hidden="true" />
                {placedByBuddy ? "Buddy added this" : "Kept for you"}
              </Badge>
            )}

            {action}

            {onMove && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onMove(card.id, "up")}
                  disabled={!canMoveUp}
                  aria-label={`Move the ${title} card earlier`}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onMove(card.id, "down")}
                  disabled={!canMoveDown}
                  aria-label={`Move the ${title} card later`}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            )}

            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => onDismiss(card.id)}
                loading={dismissing}
                title="Remove this card — your buddy won't put it back"
                aria-label={`Remove the ${title} card`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </header>
        {children}
      </section>
    </SpotlightCard>
  );
}
