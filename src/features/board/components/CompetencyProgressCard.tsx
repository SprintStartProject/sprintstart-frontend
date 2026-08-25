import { Award } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import type { BoardCard, BoardCompetency, CompetencyProgressContent } from "../types";

type CompetencyProgressCardProps = {
  content: CompetencyProgressContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (cardId: string) => void;
};

function CompetencyRow({ competency, held }: { competency: BoardCompetency; held: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className={`truncate text-sm ${held ? "text-app-text" : "text-app-text-muted"}`}>
        {competency.label}
      </span>
      <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
        {held ? `level ${competency.level}` : `${competency.level} of ${competency.targetLevel}`}
      </span>
    </li>
  );
}

/**
 * What the hire has shown they can do.
 *
 * Two lists, no percentage and no bar — a percentage of somebody's competence is a number nobody
 * can act on, and it invites reading a person as a completion figure. A competency below its target
 * shows `1 of 2`, which says what is left rather than how far along they are.
 *
 * The empty state matters more than the full one: somebody early on has shown nothing yet, and that
 * is the normal shape of a first week rather than a verdict.
 */
export function CompetencyProgressCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
  collapsed,
  onToggleCollapsed,
}: CompetencyProgressCardProps) {
  const { held, inProgress } = content;
  const nothingYet = held.length === 0 && inProgress.length === 0;

  return (
    <BoardCardFrame
      icon={Award}
      title="Where you stand"
      card={card}
      subtitle={held.length > 0 ? `${held.length} shown` : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      {nothingYet ? (
        <EmptyState size="sm">
          Nothing on your record yet. That&apos;s the normal shape of a first week — it fills in as
          work of yours is accepted.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {held.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-app-text-muted uppercase">
                Shown
              </p>
              <ul className="space-y-1">
                {held.map((competency) => (
                  <CompetencyRow key={competency.competencyKey} competency={competency} held />
                ))}
              </ul>
            </div>
          )}
          {inProgress.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-app-text-muted uppercase">
                Started
              </p>
              <ul className="space-y-1">
                {inProgress.map((competency) => (
                  <CompetencyRow
                    key={competency.competencyKey}
                    competency={competency}
                    held={false}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <AskTheBuddy
        question={
          nothingYet
            ? "Where do I stand, and what should I aim at first?"
            : "Where do I stand on my competencies, and what should I work on next?"
        }
      />
    </BoardCardFrame>
  );
}
