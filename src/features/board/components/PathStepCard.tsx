import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Footprints,
  Lightbulb,
  Link2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { boardService } from "../../../services/boardService";
import { queryKeys } from "../../../services/queryKeys";
import { SelectionCheckbox } from "../../admin/components/SelectionCheckbox";
import { BoardCardFrame } from "./BoardCardFrame";
import { Marked } from "./Marked";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { useCardMarks } from "../marks/useCardMarks";
import { PATH_STEP_FALLBACK_TITLE, type BoardCard, type PathStepContent } from "../types";

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
 * resources, the link to the full step. Ticking a task is the one write, and it goes to the path itself, not
 * to the board — the same split `ArrivalStepsCard` draws for confirming an arrival step, and the
 * card owns that write itself rather than going through the board's `editCard`, whose contract is
 * for the hire's own, authored cards. Reading this card and reading `/onboarding/:stepId` for the
 * same step must never say different things.
 *
 * Almost every field is nullable because the path underneath a placed card can be regenerated —
 * `reason` is the honest answer for a step that is gone, and the card shows it rather than
 * disappearing: a live card that vanished would read as the board losing something.
 *
 * **The tick is a two-way race, not a one-way confirmation.** `ArrivalStepsCard`'s optimistic state
 * only ever moves one direction, because a step, once settled, stays settled. A task here can be
 * ticked and unticked from two places — this card and `/onboarding/:stepId` — so an `intent` that
 * stayed forever over the props would start lying the moment the step page changes the same task
 * and the board reloads behind it. Each `intent` entry carries the server value it was set against
 * (`baseline`); the effect below drops the entry as soon as the props move away from that baseline,
 * in *either* direction — the server confirming the click, or something else changing the same task
 * first. The click wins immediately, the server wins eventually, and neither can block the other
 * from ever being true again.
 */
export function PathStepCard({ content, card, onDismiss, dismissing }: PathStepCardProps) {
  // The path writes this text, so its highlights are matched by their words rather than written
  // into it — the same reason `ArrivalStepList` reads marks off the card rather than the step.
  const marks = useCardMarks().marksFor(card.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // What the hire just clicked, laid over the server's `finished` until the props catch up. Each
  // entry remembers the server value it was set against, so the effect below can tell "the server
  // confirmed it" apart from "nothing has changed yet" without needing a second piece of state.
  const [intent, setIntent] = useState<Record<string, { value: boolean; baseline: boolean }>>({});
  // Tasks with a tick in flight — a second click on one of these does not fire a second request;
  // it updates `latestRequest` instead, which the in-flight write re-issues once it settles, so a
  // hire who ticks and immediately unticks does not lose the untick. `SelectionCheckbox` has no
  // `disabled` prop and is shared with the admin surface, so the guard lives here rather than
  // adding one there for a single caller.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [failedTaskId, setFailedTaskId] = useState<string | null>(null);
  // The value a task should end up at, kept outside React state so `runTick`'s `finally` can read
  // the latest click even when it fired while the previous write was still in flight.
  const latestRequest = useRef<Record<string, boolean>>({});

  // Drops an `intent` entry the moment the props move away from the server value it was set
  // against, so a tick made from the step page is not shadowed by a stale optimistic value here —
  // see the doc comment above. Deferred to a microtask: React 19's lint rejects a synchronous first
  // setState in an effect body.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIntent((current) => {
        if (Object.keys(current).length === 0) return current;

        const next = { ...current };
        let changed = false;
        for (const task of content.tasks) {
          const entry = next[task.id];
          if (entry && task.finished !== entry.baseline) {
            delete next[task.id];
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [content.tasks]);

  const tasks = content.tasks
    .map((task) => ({ ...task, finished: intent[task.id]?.value ?? task.finished }))
    .sort((a, b) => a.position - b.position);
  const total = tasks.length;
  const done = tasks.filter((task) => task.finished).length;
  const subtitle = [content.phaseTitle, total > 0 ? `${done}/${total} done` : null]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" · ");

  // A regenerated path can leave this card pointing at a step that is no longer there. The card
  // stays on the board and says why, rather than showing tasks and a link that no longer resolve.
  const degraded = content.reason !== null || content.stepId === null;

  function tick(taskId: string, next: boolean) {
    const server = content.tasks.find((task) => task.id === taskId)?.finished ?? next;

    latestRequest.current[taskId] = next;
    setIntent((current) => ({
      ...current,
      // The baseline is fixed by the *first* click of a run, not overwritten by later ones — it
      // has to stay the server value from before the hire started clicking so the effect above can
      // still recognize a change made somewhere else while a click here was still settling.
      [taskId]: { value: next, baseline: current[taskId]?.baseline ?? server },
    }));
    setFailedTaskId((current) => (current === taskId ? null : current));

    if (pending.has(taskId)) return;

    void runTick(taskId);
  }

  async function runTick(taskId: string) {
    const value = latestRequest.current[taskId];
    if (value === undefined) return;

    setPending((current) => new Set(current).add(taskId));

    try {
      // The response is a projection read before the write inside the same call, so it is not
      // trusted to already carry this tick — rendering it could snap a just-ticked box back.
      // `myStatuses` is invalidated instead, which is what keeps the step page and the onboarding
      // progress indicator in step with what just happened here; the board query is invalidated
      // too, so `deriveCardStates` stops reading the pre-tick `content.tasks` and the card's own
      // "N/M done" badge and its successors' `BLOCKED` state agree with what this card now shows.
      await boardService.tickPathStepTask(card.id, taskId, value);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.myStatuses() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.board.all() }),
      ]);
    } catch {
      setIntent((current) => {
        const { [taskId]: _removed, ...rest } = current;
        return rest;
      });
      delete latestRequest.current[taskId];
      setFailedTaskId(taskId);
      setPending((current) => {
        const rest = new Set(current);
        rest.delete(taskId);
        return rest;
      });
      return;
    }

    setPending((current) => {
      const rest = new Set(current);
      rest.delete(taskId);
      return rest;
    });

    // A click that landed while this write was in flight changed what the task should end up at —
    // re-issue with that value rather than leaving it stranded until some other event refetches
    // the board.
    if (latestRequest.current[taskId] === value) {
      delete latestRequest.current[taskId];
    } else {
      void runTick(taskId);
    }
  }

  return (
    <BoardCardFrame
      icon={Footprints}
      title={content.title ?? PATH_STEP_FALLBACK_TITLE}
      controlLabel="path step"
      card={card}
      subtitle={subtitle.length > 0 ? subtitle : undefined}
      onDismiss={onDismiss}
      dismissing={dismissing}
      action={
        !degraded && content.stepId ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => void navigate(`/onboarding/${content.stepId}`)}
            title="Open the full step"
            aria-label="Open the full step"
          >
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : undefined
      }
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
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-2.5">
                  <SelectionCheckbox
                    checked={task.finished}
                    onChange={() => tick(task.id, !task.finished)}
                    ariaLabel={task.title}
                  />
                  <span
                    className={`flex-1 pt-0.5 text-sm ${
                      task.finished ? "text-app-text-muted line-through" : "text-app-text"
                    }`}
                  >
                    <Marked text={task.title} marks={marks} cardId={card.id} />
                    {task.description && (
                      <span className="mt-0.5 block text-xs text-app-text-muted">
                        <Marked text={task.description} marks={marks} cardId={card.id} />
                      </span>
                    )}
                    {failedTaskId === task.id && (
                      <span role="alert" className="mt-0.5 block text-xs text-app-danger-text">
                        That didn&apos;t save. Try again in a moment.
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
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-app-text-muted">
                <Link2 className="h-3.5 w-3.5 text-app-brand" aria-hidden="true" />
                Resource{content.resources.length > 1 ? "s" : ""}
              </div>
              <ul className="space-y-1.5">
                {content.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2 text-sm"
                    >
                      <ExternalLink
                        className="mt-0.5 h-4 w-4 shrink-0 text-app-text-muted transition-colors group-hover:text-app-brand"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-app-text group-hover:text-app-brand-text group-hover:underline">
                          {resource.title}
                        </span>
                        {resource.description && (
                          <span className="mt-0.5 block text-xs text-app-text-muted">
                            {resource.description}
                          </span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
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
