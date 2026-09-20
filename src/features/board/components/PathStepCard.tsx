import { CheckCircle2, ExternalLink, Footprints, Lightbulb, MoveRight } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState";
import { BoardCardFrame } from "./BoardCardFrame";
import { Marked } from "./Marked";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { useCardMarks } from "../marks/useCardMarks";
import type { BoardCard, PathStepContent } from "../types";

type PathStepCardProps = {
  content: PathStepContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
};

/**
 * The hire's current step of their onboarding path, live — the one card in the catalog that is
 * `AI`-owned and still partly the hire's to change.
 *
 * Everything on it but the tasks is a read straight from the path: the title, the outcomes, the
 * resources, the footer link. Ticking a task is the one write, and it goes to the path itself, not
 * to the board — the same split `ArrivalStepsCard` draws for confirming an arrival step. Reading
 * this card and reading `/onboarding/:stepId` for the same step must never say different things.
 *
 * Almost every field is nullable because the path underneath a placed card can be regenerated —
 * `reason` is the honest answer for a step that is gone, and the card shows it rather than
 * disappearing: a live card that vanished would read as the board losing something.
 */
export function PathStepCard({ content, card, onDismiss, dismissing }: PathStepCardProps) {
  // The path writes this text, so its highlights are matched by their words rather than written
  // into it — the same reason `ArrivalStepList` reads marks off the card rather than the step.
  const marks = useCardMarks().marksFor(card.id);
  const total = content.tasks.length;
  const done = content.tasks.filter((task) => task.finished).length;
  const subtitle = [content.phaseTitle, total > 0 ? `${done}/${total} done` : null]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" · ");

  // A regenerated path can leave this card pointing at a step that is no longer there. The card
  // stays on the board and says why, rather than showing tasks and a link that no longer resolve.
  const degraded = content.reason !== null || content.stepId === null;

  return (
    <BoardCardFrame
      icon={Footprints}
      title={content.title ?? "A step of your path"}
      controlLabel="path step"
      card={card}
      subtitle={subtitle.length > 0 ? subtitle : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
    >
      {degraded ? (
        <EmptyState size="sm">
          {content.reason ?? "This step is no longer on your path."}
        </EmptyState>
      ) : (
        <>
          {content.description && (
            <p className="mb-3 text-sm text-app-text-muted">
              <Marked text={content.description} marks={marks} cardId={card.id} />
            </p>
          )}

          {total > 0 && (
            <ul className="space-y-1.5">
              {[...content.tasks]
                .sort((a, b) => a.position - b.position)
                .map((task) => (
                  <li key={task.id} className="flex items-start gap-2.5">
                    {/* A picture of the state, not a control — ticking a task lives on
                        `/onboarding/:stepId` for now and lands here too. */}
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${
                        task.finished
                          ? "border-app-brand bg-app-brand text-white"
                          : "border-app-border bg-app-surface"
                      }`}
                    >
                      {task.finished && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span
                      className={`flex-1 text-sm ${
                        task.finished ? "text-app-text-muted line-through" : "text-app-text"
                      }`}
                    >
                      <Marked text={task.title} marks={marks} cardId={card.id} />
                      <span className="sr-only">{task.finished ? " — done" : " — not done"}</span>
                      {task.description && (
                        <span className="mt-0.5 block text-xs text-app-text-muted">
                          <Marked text={task.description} marks={marks} cardId={card.id} />
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          )}

          {content.expectedOutcomes.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-app-text-muted">
                <Lightbulb className="h-3.5 w-3.5 text-app-brand" aria-hidden="true" />
                Expected outcome{content.expectedOutcomes.length > 1 ? "s" : ""}
              </div>
              <ul className="space-y-1.5">
                {content.expectedOutcomes.map((outcome, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-app-text">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-app-success-solid"
                      aria-hidden="true"
                    />
                    <Marked text={outcome} marks={marks} cardId={card.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.resources.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-app-text-muted">Resources</p>
              <div className="space-y-1.5">
                {content.resources.map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between gap-2 rounded-xl border border-app-border p-2.5 transition-colors hover:border-app-brand-border-strong"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-app-text">{resource.title}</p>
                      {resource.description && (
                        <p className="mt-0.5 truncate text-xs text-app-text-subtle">
                          {resource.description}
                        </p>
                      )}
                    </div>
                    <ExternalLink
                      className="h-4 w-4 shrink-0 text-app-text-subtle transition-colors group-hover:text-app-brand"
                      aria-hidden="true"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {content.stepId && (
            <Link
              to={`/onboarding/${content.stepId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-app-brand-text hover:underline"
            >
              Open the full step
              <MoveRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </>
      )}

      <AskTheBuddy
        question={
          degraded
            ? "The step my board was pointing me to is gone — what should I work on now?"
            : total > done
              ? "I'm stuck on one of the tasks in my current step — can you help?"
              : "I've finished the tasks in this step. What's next?"
        }
      />
    </BoardCardFrame>
  );
}
