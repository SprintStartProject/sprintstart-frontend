import type { ReactNode } from "react";
import { Bot, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
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
    <section className="flex flex-col rounded-2xl border border-app-border bg-app-surface p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-app-text">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-app-text-muted">{subtitle}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {card.owner === "AI" && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-app-brand/10 px-2 py-0.5 text-[11px] font-medium text-app-brand-text"
              title={
                placedByBuddy
                  ? "Your buddy put this here — it reads your onboarding live"
                  : "Kept up to date for you — this card reads your onboarding live"
              }
            >
              <Bot className="h-3 w-3" aria-hidden="true" />
              {placedByBuddy ? "Buddy added this" : "Kept for you"}
            </span>
          )}

          {action}

          {onMove && (
            <>
              <button
                type="button"
                onClick={() => onMove(card.id, "up")}
                disabled={!canMoveUp}
                aria-label={`Move the ${title} card earlier`}
                className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onMove(card.id, "down")}
                disabled={!canMoveDown}
                aria-label={`Move the ${title} card later`}
                className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(card.id)}
              disabled={dismissing}
              title="Remove this card — your buddy won't put it back"
              aria-label={`Remove the ${title} card`}
              className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              {dismissing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
