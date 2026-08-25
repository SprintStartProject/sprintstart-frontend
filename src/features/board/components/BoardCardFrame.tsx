import { useState, type ReactNode } from "react";
import { ChevronsDownUp, ChevronsUpDown, Bot, Pin, PinOff, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { useBoardCardControls } from "./boardCardControls";
import type { BoardCard } from "../types";

type BoardCardFrameProps = {
  title: string;
  /**
   * The card's own glyph, shown in muted ink beside the title.
   *
   * Per kind, and the same icon the rest of the app already uses for that thing — a link is the
   * link glyph here and in the add form. Deliberately a bare glyph in muted ink rather than a
   * filled chip: eleven coloured tiles down a column read as eleven buttons, and none of them is.
   * It is here so a card can be found by shape before it is read; the colour comes from the bloom.
   */
  icon: LucideIcon;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  /** Optional one-line note under the title, e.g. what the card is counting. */
  subtitle?: string;
  /**
   * What the card is called in its controls' accessible names, when the visible title is not a
   * name for the card. A note titles itself with its own first line, so "Remove the deploys are on
   * Thursdays card" would be the label; `controlLabel="note"` keeps it "Remove the note card".
   */
  controlLabel?: string;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  /** A kind-specific control in the header, e.g. "edit this note". */
  action?: ReactNode;
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
 * suggested otherwise would misdescribe a decision as a gesture. Folding is the opposite and says
 * so — a folded card is still on the board, and unfolding it is one click.
 *
 * **A pin keeps its icon on show.** Every other control fades out when the pointer leaves, but a
 * pinned card has to say it is pinned even when nobody is near it — the alternative is a card that
 * sits at the top of the board for a reason the hire cannot see. The state is carried by the icon
 * and its label, never by the position alone.
 *
 * Attribution is a `Badge` and every control is a `Button`, so the header picks up the app's one
 * pill and its one icon-button treatment — focus ring, press motion, disabled state and touch
 * target included — instead of re-deriving them here. The surface is a `SpotlightCard`, the same
 * card the pool, the source list and the dashboard widgets sit on.
 *
 * **The controls fade in on hover, from `lg` up only.** Four icon buttons on eleven cards is more
 * chrome than content, and none of them is what the hire came to the board to read. They keep
 * their space in the header rather than expanding into it, so nothing shifts under the pointer,
 * and `focus-within` brings them back for a keyboard user. Below `lg` — where there is no hover
 * to reveal anything — they stay visible, as they do while a dismissal is in flight and while the
 * board is being arranged.
 *
 * The body stops taking clicks while the board is being arranged, so a card that is a drag target
 * does not also tick a checkbox on the way past. That is driven by `data-arranging` on the grid
 * rather than by a prop, because it is a fact about the board and not about any one card — and the
 * header is deliberately outside it, so the controls keep working while everything else is a
 * handle.
 */
export function BoardCardFrame({
  title,
  icon: Icon,
  card,
  subtitle,
  controlLabel,
  onDismiss,
  dismissing = false,
  action,
  children,
}: BoardCardFrameProps) {
  const { collapsed, pinned, accent, onToggleCollapsed, onTogglePinned, dragHandle, groupPicker } =
    useBoardCardControls();

  // A folded card opens while it is under the pointer and closes again when it is left. The fold
  // is for getting a card out of the way, not for hiding it — having to unfold, read one line and
  // fold it again is three clicks for a glance. Focus counts as approach too, so a keyboard user
  // reaches the same thing by tabbing into the card.
  const [peeking, setPeeking] = useState(false);
  const open = !collapsed || peeking;

  const placedByBuddy = card.placedAt !== null;
  const label = controlLabel ?? title;
  const reveal = dismissing
    ? ""
    : "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 [[data-arranging]_&]:opacity-100";

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      // A visible "this can be moved" state while the board is being arranged, matching the ring
      // the dashboard puts on its widgets in edit mode.
      className="[[data-arranging]_&]:ring-2 [[data-arranging]_&]:ring-app-border-muted"
    >
      <section
        className="relative flex flex-col overflow-hidden p-4"
        onPointerEnter={() => collapsed && setPeeking(true)}
        onPointerLeave={() => setPeeking(false)}
        onFocusCapture={() => collapsed && setPeeking(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPeeking(false);
        }}
      >
        {/* The dashboard's colour, on the board: a soft bloom in the corner, tinted by the card's
            kind. Decorative and click-through, so it never sits between the reader and a control. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-14 -right-14 h-36 w-36 rounded-full blur-2xl ${accent.bloom}`}
        />

        <header className={`relative flex items-start justify-between gap-3 ${open ? "mb-3" : ""}`}>
          <div className="flex min-w-0 items-start gap-2">
            {dragHandle && (
              <span
                // The grip takes its space up front rather than expanding into the row, so a title
                // does not shuffle sideways the moment the pointer arrives. Deliberately *not*
                // swallowing the press the way the control cluster does — this one starts the drag.
                className={`-ml-1 transition-opacity duration-150 ${reveal}`}
              >
                {dragHandle}
              </span>
            )}

            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${accent.icon}`} aria-hidden="true" />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="line-clamp-2 text-sm font-semibold text-app-text">{title}</h2>

                {pinned && (
                  <Badge variant="neutral" size="sm" className="gap-1">
                    <Pin className="h-3 w-3" aria-hidden="true" />
                    Pinned
                  </Badge>
                )}

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
              </div>
              {subtitle && <p className="mt-1 text-xs text-app-text-muted">{subtitle}</p>}
            </div>
          </div>

          <div
            // Keeps a press on a control from also grabbing the card underneath while arranging.
            onPointerDownCapture={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-1"
          >
            {groupPicker}

            {onTogglePinned && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onTogglePinned}
                aria-pressed={pinned}
                aria-label={pinned ? `Unpin the ${label} card` : `Pin the ${label} card to the top`}
                // Deliberately outside `reveal`: a pin is a state, and a state that only shows on
                // hover is a state the hire has to go looking for.
                className={
                  pinned ? "text-app-brand-text" : `transition-opacity duration-150 ${reveal}`
                }
              >
                {pinned ? (
                  <PinOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pin className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}

            <span className={`flex items-center gap-1 transition-opacity duration-150 ${reveal}`}>
              {onToggleCollapsed && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={onToggleCollapsed}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? `Unfold the ${label} card` : `Fold the ${label} card`}
                >
                  {collapsed ? (
                    <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              )}

              {open && action}

              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => onDismiss(card.id)}
                  loading={dismissing}
                  title="Remove this card — your buddy won't put it back"
                  aria-label={`Remove the ${label} card`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </span>
          </div>
        </header>

        {open && (
          <div className="relative [[data-arranging]_&]:pointer-events-none [[data-arranging]_&]:select-none">
            {children}
          </div>
        )}
      </section>
    </SpotlightCard>
  );
}
