import { ChecklistCard } from "./ChecklistCard";
import { CompetencyProgressCard } from "./CompetencyProgressCard";
import { CurrentTaskCard } from "./CurrentTaskCard";
import { DiagramCard } from "./DiagramCard";
import { LinkCard } from "./LinkCard";
import { MemoryRecapCard } from "./MemoryRecapCard";
import { NoteCard } from "./NoteCard";
import { ArrivalStepsCard } from "./ArrivalStepsCard";
import { OpenPullRequestsCard } from "./OpenPullRequestsCard";
import { PathToFirstContributionCard } from "./PathToFirstContributionCard";
import { SuggestedTasksCard } from "./SuggestedTasksCard";
import type { AuthoredCardRequest, Board, BoardCard } from "../types";

type BoardGridProps = {
  board: Board;
  onDismiss?: (cardId: string) => void;
  dismissingId?: string | null;
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  /** Applies a whole new order. Absent when the board is not arrangeable. */
  onReorder?: (cardIds: string[]) => void;
};

type SharedProps = {
  card: BoardCard;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

/**
 * Renders one card by its kind.
 *
 * The catalog is closed, so this switch is exhaustive by construction — but an unknown kind still
 * renders something visible rather than nothing: a card that silently disappears because the client
 * is a version behind is indistinguishable from the mentor never having placed it.
 */
function BoardCardView({
  card,
  onEdit,
  ...shared
}: SharedProps & { onEdit?: (cardId: string, request: AuthoredCardRequest) => void }) {
  const props = { card, ...shared };
  switch (card.content.kind) {
    case "PATH_TO_FIRST_CONTRIBUTION":
      return <PathToFirstContributionCard content={card.content} {...props} />;
    case "ARRIVAL_STEPS":
      return <ArrivalStepsCard content={card.content} {...props} />;
    case "OPEN_PULL_REQUESTS":
      return <OpenPullRequestsCard content={card.content} {...props} />;
    case "CURRENT_TASK":
      return <CurrentTaskCard content={card.content} {...props} />;
    case "SUGGESTED_TASKS":
      return <SuggestedTasksCard content={card.content} {...props} />;
    case "COMPETENCY_PROGRESS":
      return <CompetencyProgressCard content={card.content} {...props} />;
    case "MEMORY_RECAP":
      return <MemoryRecapCard content={card.content} {...props} />;
    case "DIAGRAM":
      return <DiagramCard content={card.content} {...props} />;
    case "NOTE":
      return <NoteCard content={card.content} onEdit={onEdit} {...props} />;
    case "LINK":
      return <LinkCard content={card.content} {...props} />;
    case "CHECKLIST":
      return <ChecklistCard content={card.content} onEdit={onEdit} {...props} />;
    default:
      return (
        <section className="rounded-2xl border border-dashed border-app-border p-4">
          <p className="text-sm text-app-text-muted">
            This card needs a newer version of the app to show.
          </p>
        </section>
      );
  }
}

/**
 * The board's layout: a responsive grid, in board order.
 *
 * A grid rather than a free x/y canvas — each card can still contain a graph or a diagram, and a
 * canvas does not survive a phone screen.
 *
 * Rearranging is a pair of move buttons on every card rather than a drag. A drag is the nicer
 * gesture, but it is the *only* gesture in most implementations, and a board you can only arrange
 * with a mouse is a board some people cannot arrange at all. Moving one card sends the whole
 * resulting order, because that is what the board now looks like.
 */
export function BoardGrid({
  board,
  onDismiss,
  dismissingId = null,
  onEdit,
  onReorder,
}: BoardGridProps) {
  const move = onReorder
    ? (cardId: string, direction: "up" | "down") => {
        const ids = board.cards.map((card) => card.id);
        const from = ids.indexOf(cardId);
        const to = direction === "up" ? from - 1 : from + 1;
        if (from === -1 || to < 0 || to >= ids.length) return;
        const next = [...ids];
        [next[from], next[to]] = [next[to], next[from]];
        onReorder(next);
      }
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {board.cards.map((card, index) => (
        <BoardCardView
          key={card.id}
          card={card}
          onDismiss={onDismiss}
          dismissing={dismissingId === card.id}
          onEdit={onEdit}
          onMove={move}
          canMoveUp={index > 0}
          canMoveDown={index < board.cards.length - 1}
        />
      ))}
    </div>
  );
}
