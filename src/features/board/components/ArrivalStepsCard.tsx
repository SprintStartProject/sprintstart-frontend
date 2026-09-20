import { useEffect, useState } from "react";
import { PlaneLanding } from "lucide-react";
import { arrivalService } from "../../../services/arrivalService";
import { Spinner } from "../../../components/ui/Spinner";
import { BoardCardFrame } from "./BoardCardFrame";
import { useCardMarks } from "../marks/useCardMarks";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { ArrivalStepList } from "../../arrival/components/ArrivalStepList";
import { summarise } from "../../arrival/summarise";
import type { ArrivalStep } from "../../arrival/types";
import type { ArrivalStepsContent, BoardCard } from "../types";

type ArrivalStepsCardProps = {
  content: ArrivalStepsContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
};

/**
 * What still has to be true before this hire can work: accounts, access, a machine that builds.
 *
 * Nothing here withholds anything. The card shows outstanding work; it never blocks a hire
 * from claiming a task or reading anything else.
 *
 * No progress bar, and no percentage may be added. A step the system observed and a step the
 * hire ticked are different facts, and averaging them counts a ticked box exactly like a passed
 * check. The subtitle says what is known and leaves the arithmetic to the reader.
 *
 * Confirmation is applied here rather than through the board's write path: settling a step is a
 * fact about the hire, not an edit to the board, so the card owns the optimistic update.
 *
 * It re-checks itself once after rendering, because the board's read touches nothing but the
 * database. Failing to ask changes nothing on screen: observation settles a step and failing to
 * observe never unsettles one, so an outage, a rate limit and a hire with no work yet are one and
 * the same answer here.
 */
export function ArrivalStepsCard({ content, card, onDismiss, dismissing }: ArrivalStepsCardProps) {
  // Derived, not synced: the card re-reads on every board load, and a confirmation that has
  // landed should not be undone by a stale prop. Same shape the diagram card uses for `redrawn`.
  const [confirmed, setConfirmed] = useState<Record<string, ArrivalStep>>({});
  // Steps are authored by whoever set the project up and re-read here, so their highlights are
  // matched by their words rather than written into the text — see `marks/cardMarks.ts`.
  const marks = useCardMarks().marksFor(card.id);
  const [rechecked, setRechecked] = useState<ArrivalStep[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred to a microtask: React 19's lint rejects a synchronous first setState in an
    // effect body, and this is the pattern the repo already passes with.
    void (async () => {
      if (cancelled) return;
      setChecking(true);
      try {
        const fresh = await arrivalService.refreshMyArrival();
        if (!cancelled) setRechecked(fresh.steps);
      } catch {
        // Nothing to say and nothing to undo. A check that could not run is not evidence
        // that a step is outstanding, and the list the board handed us is still true.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The hire's own confirmation wins over anything a check saw, because it may have landed while
  // the check was in flight -- the same precedence the backend keeps when it writes.
  const steps = (rechecked ?? content.steps).map((step) => confirmed[step.key] ?? step);
  const outstanding = steps.filter((step) => !step.settled).length;
  const observed = steps.filter((step) => step.rigor === "OBSERVED").length;
  const declared = steps.filter((step) => step.rigor === "DECLARED").length;

  async function confirm(step: ArrivalStep) {
    setPendingKey(step.key);
    setFailedKey(null);
    try {
      const settled = await arrivalService.confirmStep(step.key);
      setConfirmed((current) => ({ ...current, [step.key]: settled }));
    } catch {
      setFailedKey(step.key);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <BoardCardFrame
      icon={PlaneLanding}
      title="Getting you set up"
      card={card}
      onDismiss={onDismiss}
      dismissing={dismissing}
      subtitle={summarise({ observed, declared, outstanding })}
    >
      <ArrivalStepList
        steps={steps}
        marks={marks}
        cardId={card.id}
        pendingKey={pendingKey}
        failedKey={failedKey}
        onConfirm={(step) => void confirm(step)}
      />

      {/*
              Shown only while it runs, and with no failure state behind it: a check that could not
              run has nothing to report, and "we could not reach GitHub" on somebody's board is
              noise about a step they may not even have.
            */}
      {checking && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-app-text-muted">
          <Spinner size="sm" silent />
          Checking what we can see for ourselves…
        </p>
      )}

      <AskTheBuddy
        question={
          outstanding > 0
            ? "I'm stuck on one of my setup steps — who do I ask?"
            : "I'm set up now. What should I look at first?"
        }
      />
    </BoardCardFrame>
  );
}
