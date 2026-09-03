import { useState, type ReactNode } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Bot,
  CircleCheckBig,
  CircleDashed,
  Layers,
  Lock,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Collapsible } from "../../../components/ui/Collapsible";
import { SpotlightCard } from "../../../components/ui/SpotlightCard";
import { cardName } from "../layout/cardNames";
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
 * **The controls float in on approach and take no room at rest.** Four icon buttons on eleven cards
 * is more chrome than content, and none of them is what the hire came to the board to read. They
 * used to fade but keep their width, which is the arrangement that squeezed the title on a narrow
 * card down to an ellipsis: reserved space is reserved whether or not anything is drawn in it. Now
 * the cluster is lifted out of the header's flow, so the title has the whole row until somebody
 * comes near, and `focus-within` brings the cluster back for a keyboard user. While the board is
 * being arranged it sits in the flow again — there it holds the stage and dependency pickers and
 * *is* what somebody came for.
 *
 * **A blocked card stays visible and goes quiet.** It is dimmed and says what it is waiting on,
 * rather than being hidden or disabled: a hire who cannot yet do something is entitled to know it
 * exists and why it is not their turn, and a card that vanished until its moment would read as the
 * board losing things. Nothing about it is actually locked — the block is a statement about order,
 * not a permission, and somebody who has a reason to get on with it still can.
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
  const {
    collapsed,
    pinned,
    accent,
    onToggleCollapsed,
    onTogglePinned,
    dragHandle,
    groupPicker,
    state,
    onToggleDone,
    stagePicker,
    dependencyPicker,
    stack,
    resizeHandle,
  } = useBoardCardControls();

  // A folded card opens while it is under the pointer and closes again when it is left. The fold
  // is for getting a card out of the way, not for hiding it — having to unfold, read one line and
  // fold it again is three clicks for a glance. Focus counts as approach too, so a keyboard user
  // reaches the same thing by tabbing into the card.
  const [peeking, setPeeking] = useState(false);
  const open = !collapsed || peeking;

  const placedByBuddy = card.placedAt !== null;
  const blocked = state?.status === "BLOCKED";
  const done = state?.status === "DONE";
  const label = controlLabel ?? title;
  /** The grip's own fade. The rest of the controls travel together — see the cluster below. */
  const reveal = dismissing
    ? ""
    : "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 [[data-arranging]_&]:opacity-100";

  return (
    <SpotlightCard
      roundedClassName="rounded-2xl"
      // A visible "this can be moved" state while the board is being arranged, matching the ring
      // the dashboard puts on its widgets in edit mode.
      className={`[[data-arranging]_&]:ring-2 [[data-arranging]_&]:ring-app-border-muted ${
        // Turned down rather than turned off. Full opacity would put a card nobody can act on at
        // the same volume as the one they should be reading; hiding it would lose the fact that it
        // is coming. Restored on approach, so reading a blocked card costs nothing.
        blocked ? "opacity-60 transition-opacity focus-within:opacity-100 hover:opacity-100" : ""
      }`}
    >
      <section
        // The board's density setting, read off the grid root rather than passed in — a card should
        // not have to be told how much padding the board is in the mood for.
        className="relative flex flex-col overflow-hidden p-4 pl-5 [[data-density=compact]_&]:p-2.5 [[data-density=compact]_&]:pl-4"
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

        {/* The kind, in the one place the eye reads without being asked to. A card is recognised at
            a glance by its edge long before its title is read, so this is what turns a board of
            mixed kinds from one texture into a sorted one. */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${accent.edge}`}
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

            {/* The glyph in a tinted square rather than loose on the surface: the same colour
                twice the size, which is what makes two cards of a kind look like a pair. */}
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accent.chip}`}
            >
              <Icon className={`h-3.5 w-3.5 ${accent.icon}`} aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="line-clamp-2 text-sm font-semibold text-app-text">{title}</h2>

                {pinned && (
                  <Badge variant="neutral" size="sm" className="gap-1">
                    <Pin className="h-3 w-3" aria-hidden="true" />
                    Pinned
                  </Badge>
                )}

                {/* Purple, not green: "done" sits beside status pills that mean healthy, and a
                    finished card is a state reached rather than a thing going well. Icon and word
                    both, so the colour is never the message. */}
                {done && (
                  <Badge variant="purple" size="sm" className="gap-1">
                    <CircleCheckBig className="h-3 w-3" aria-hidden="true" />
                    Done
                  </Badge>
                )}

                {blocked && (
                  <Badge variant="neutral" size="sm" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Waiting
                  </Badge>
                )}

                {/* A badge that is also the way in. `aria-expanded` says what it does, and the
                    count is the reassurance that opening it holds no surprises — a pile whose
                    depth you cannot see is a pile you do not trust to be small. Deliberately not
                    the whole card: these cards are full of things to click, and a card that both
                    ticks a checkbox and unfolds a stack gets one of the two wrong. */}
                {stack && (
                  <button
                    type="button"
                    onClick={stack.onToggle}
                    aria-expanded={false}
                    aria-label={`Show all ${stack.total} cards in this sequence`}
                    className="inline-flex items-center gap-1 rounded-full border border-app-brand-border bg-app-brand-soft px-2 py-0.5 text-xs font-medium text-app-brand-text transition-colors hover:bg-app-brand hover:text-white focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    <span className="tabular-nums">
                      Step {stack.position} of {stack.total}
                    </span>
                  </button>
                )}

                {/* The mark, not the sentence. Who placed a card is worth knowing and is almost
                    never what the hire is here to read — and spelled out it was the widest thing in
                    the header, pushing the title onto a second line on half the cards. The icon
                    keeps the fact on screen; the tooltip and the screen-reader text keep the
                    sentence for whoever wants it. */}
                {card.owner === "AI" && (
                  <Badge
                    variant="brand"
                    size="sm"
                    title={
                      placedByBuddy
                        ? "Your buddy put this here — it reads your onboarding live"
                        : "Kept up to date for you — this card reads your onboarding live"
                    }
                  >
                    <Bot className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">
                      {placedByBuddy ? "Your buddy added this card" : "Kept up to date for you"}
                    </span>
                  </Badge>
                )}
              </div>
              {subtitle && <p className="mt-1 text-xs text-app-text-muted">{subtitle}</p>}

              {/* Named, not counted. "Waiting on 2 cards" tells the hire they are stuck; naming
                  them tells them what to go and do about it. */}
              {blocked && state && (
                <p className="mt-1 text-xs text-app-text-muted">
                  Don{"\u2019"}t start yet — first finish{" "}
                  <span className="font-medium text-app-text">
                    {state.blockedBy.map((blocker) => cardName(blocker)).join(", ")}
                  </span>
                  .
                </p>
              )}
            </div>
          </div>

          <div
            // Keeps a press on a control from also grabbing the card underneath while arranging.
            onPointerDownCapture={(event) => event.stopPropagation()}
            // Lifted out of the flow until somebody comes near the card.
            //
            // The cluster used to sit in the header row and hold its width whether or not it was
            // showing anything — four icon buttons' worth of reserved space on every card, all the
            // time. On a wide card that is a gap; on a card one column of four wide it was most of
            // the header, and the title — the one thing on a card that cannot be guessed from
            // anything else — was squeezed down to an ellipsis. Floated, the header is the title's
            // for as long as nobody is doing anything, which is nearly always.
            //
            // The states it used to keep visible are not lost with it: "Pinned" and "Done" are
            // badges next to the title, and they are the ones that say so.
            //
            // Not floated while the board is being arranged: there the cluster carries the stage
            // and the "waits on" pickers, it *is* what somebody came for, and a panel of selects
            // hovering over the title would be the mode fighting itself.
            className={`absolute top-0 right-0 z-10 flex items-center gap-1 rounded-xl bg-app-surface/90 px-1 opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 [[data-arranging]_&]:pointer-events-auto [[data-arranging]_&]:static [[data-arranging]_&]:bg-transparent [[data-arranging]_&]:opacity-100 [[data-arranging]_&]:shadow-none [[data-arranging]_&]:backdrop-blur-none ${
              dismissing ? "" : "pointer-events-none"
            }`}
          >
            {stagePicker}
            {dependencyPicker}

            {onToggleDone && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onToggleDone}
                aria-pressed={done}
                aria-label={
                  done ? `Mark the ${label} card as not done` : `Mark the ${label} card as done`
                }
                title={
                  done
                    ? "Not finished after all"
                    : "Tick this off — it stops blocking whatever waits on it"
                }
                className={done ? "text-app-purple-text" : undefined}
              >
                {done ? (
                  <CircleCheckBig className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CircleDashed className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}

            {onTogglePinned && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onTogglePinned}
                aria-pressed={pinned}
                aria-label={pinned ? `Unpin the ${label} card` : `Pin the ${label} card to the top`}
                className={pinned ? "text-app-brand-text" : undefined}
              >
                {pinned ? (
                  <PinOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Pin className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}

            <span className="flex items-center gap-1">
              {groupPicker}

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

        <Collapsible open={open}>
          <div className="relative [[data-arranging]_&]:pointer-events-none [[data-arranging]_&]:select-none">
            {children}
          </div>
        </Collapsible>

        {/* Last in the box and pinned to its corner: the handle belongs to the card, not to any
            one thing on it, and the bottom-right is where every resize in every app lives. */}
        {resizeHandle}
      </section>
    </SpotlightCard>
  );
}
