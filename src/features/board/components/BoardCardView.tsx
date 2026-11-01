import { ArrivalStepsCard } from "./ArrivalStepsCard";
import { ChecklistCard } from "./ChecklistCard";
import { CompetencyProgressCard } from "./CompetencyProgressCard";
import { CurrentTaskCard } from "./CurrentTaskCard";
import { DiagramCard } from "./DiagramCard";
import { LinkCard } from "./LinkCard";
import { MemoryRecapCard } from "./MemoryRecapCard";
import { NoteCard } from "./NoteCard";
import { OpenPullRequestsCard } from "./OpenPullRequestsCard";
import { PathStepCard } from "./PathStepCard";
import { SuggestedTasksCard } from "./SuggestedTasksCard";
import { TaskPoolCard } from "./TaskPoolCard";
import type { CardOrigin } from "../layout/cardOrigins";
import type { AuthoredCardRequest, BoardCard, BoardUndoNotice } from "../types";

type SharedProps = {
  card: BoardCard;
  onDismiss?: (cardId: string) => void;
  dismissing: boolean;
  /** Where this card came from, for the kinds that can have been found somewhere. */
  origin?: CardOrigin | null;
  /** Told when this card made another one — see `BoardGridProps.onCardAdded`. */
  onCardAdded?: () => void;
};

/**
 * Renders one card by its kind.
 *
 * The catalog is closed, so this switch is exhaustive by construction — but an unknown kind still
 * renders something visible rather than nothing: a card that silently disappears because the client
 * is a version behind is indistinguishable from the mentor never having placed it.
 */
type BoardCardViewProps = SharedProps & {
  onEdit?: (cardId: string, request: AuthoredCardRequest) => void;
  onRestorePrevious?: (cardId: string, replacedAt: string) => void;
  /** True while this card's own undo is in flight. */
  restoring: boolean;
  /** True while this card is being written to — an edit, or a tick, still on its way. */
  saving: boolean;
  /** What just happened to this card's undo, when anything did. */
  undoNotice: BoardUndoNotice | null;
};

export function BoardCardView(props: BoardCardViewProps) {
  switch (props.card.content.kind) {
    case "NOTE":
    case "LINK":
    case "CHECKLIST":
      return <AuthoredCardView {...props} />;
    default:
      return <LiveCardView {...props} />;
  }
}

function UnknownCard() {
  return (
    <section className="rounded-2xl border border-dashed border-app-border p-4">
      <p className="text-sm text-app-text-muted">
        This card needs a newer version of the app to show.
      </p>
    </section>
  );
}

/** The cards the board computes for the hire, none of which was ever found anywhere. */
function LiveCardView({ card, onCardAdded, ...shared }: BoardCardViewProps) {
  // Only the authored kinds take an origin — all three of them now, since a checklist minted from
  // a task is as found as a note taken from a paragraph. It is left out of what is spread here: a
  // live card was never found anywhere, and handing it a prop it ignores invites somebody to wire
  // one up later and wonder why nothing shows.
  const props = {
    card,
    onDismiss: shared.onDismiss,
    dismissing: shared.dismissing,
  };
  switch (card.content.kind) {
    case "ARRIVAL_STEPS":
      return <ArrivalStepsCard content={card.content} {...props} />;
    case "OPEN_PULL_REQUESTS":
      return <OpenPullRequestsCard content={card.content} {...props} />;
    case "CURRENT_TASK":
      return <CurrentTaskCard content={card.content} onCardAdded={onCardAdded} {...props} />;
    case "SUGGESTED_TASKS":
      return <SuggestedTasksCard content={card.content} onCardAdded={onCardAdded} {...props} />;
    case "TASK_POOL":
      return <TaskPoolCard content={card.content} {...props} />;
    case "COMPETENCY_PROGRESS":
      return <CompetencyProgressCard content={card.content} {...props} />;
    case "MEMORY_RECAP":
      return <MemoryRecapCard content={card.content} {...props} />;
    case "DIAGRAM":
      return <DiagramCard content={card.content} {...props} />;
    case "PATH_STEP":
      return <PathStepCard content={card.content} {...props} />;
    default:
      return <UnknownCard />;
  }
}

/** The cards somebody wrote, which can be edited, undone and traced back to where they came from. */
function AuthoredCardView({
  card,
  onEdit,
  onRestorePrevious,
  restoring,
  saving,
  undoNotice,
  origin,
  onDismiss,
  dismissing,
}: BoardCardViewProps) {
  const props = { card, onDismiss, dismissing };
  const undo = { onRestorePrevious, restoring, saving, undoNotice, origin };
  switch (card.content.kind) {
    case "NOTE":
      return <NoteCard content={card.content} onEdit={onEdit} {...undo} {...props} />;
    case "LINK":
      return <LinkCard content={card.content} {...undo} {...props} />;
    case "CHECKLIST":
      return <ChecklistCard content={card.content} onEdit={onEdit} {...undo} {...props} />;
    default:
      return <UnknownCard />;
  }
}
