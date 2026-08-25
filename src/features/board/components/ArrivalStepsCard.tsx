import { useEffect, useState } from "react";
import { Check, ExternalLink, PlaneLanding } from "lucide-react";
import { arrivalService } from "../../../services/arrivalService";
import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { BoardCardFrame } from "./BoardCardFrame";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { groupByScope } from "../../arrival/scopeGroups";
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

  // Headings only earn their space once there is more than one scope. A lone "Everyone" over a
  // list that is entirely company-wide -- the normal case -- is a label saying nothing.
  const groups = groupByScope(steps);
  const showScopeHeadings = groups.length > 1;

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
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.projectName ?? "__company__"} className="space-y-2">
            {/*
                          Company-wide reads "Everyone" rather than "Company": it answers the
                          question a heading raises -- who else has this step -- instead of naming
                          the scope's implementation.
                        */}
            {showScopeHeadings && (
              <h4 className="text-xs font-semibold tracking-wider text-app-text-muted uppercase">
                {group.projectName ?? "Everyone"}
              </h4>
            )}
            <ul className="space-y-2">
              {group.steps.map((step) => (
                <StepRow
                  key={step.key}
                  step={step}
                  pending={pendingKey === step.key}
                  failed={failedKey === step.key}
                  onConfirm={() => void confirm(step)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

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

/**
 * One step: what it is, whether it is settled, and — when it is the hire's to settle — the way to
 * say so.
 *
 * Extracted when scope headings arrived: with a section and a list above it, the row's own markup
 * sat five levels deep, which is where a JSX block stops being readable and starts being edited by
 * guesswork.
 */
function StepRow({
  step,
  pending,
  failed,
  onConfirm,
}: {
  step: ArrivalStep;
  pending: boolean;
  failed: boolean;
  onConfirm: () => void;
}) {
  return (
    <li
      className={`rounded-xl border p-3 ${
        step.settled ? "border-app-border bg-app-surface-muted/40" : "border-app-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm ${step.settled ? "text-app-text-muted" : "text-app-text"}`}>
            {step.title}
          </p>
          {step.description && (
            <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>
          )}
          {step.settled && <SettledNote step={step} />}
          {failed && (
            <p className="mt-1 text-xs text-app-danger-text">
              That didn&apos;t save. Try again in a moment.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {step.href && !step.settled && (
            <a
              href={step.href}
              target="_blank"
              rel="noreferrer"
              className="text-app-text-muted transition hover:text-app-text"
              aria-label={`Open the page for "${step.title}"`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          {step.settled ? (
            <Check className="h-4 w-4 text-app-success-text" aria-label="Done" />
          ) : (
            // `selfConfirmable`, not `settledBy === 'DECLARED'`: a step can be derived
            // *and* the hire's to claim. "My machine builds" is observable but never
            // refutable, and the evidence lands days after it mattered, so their word is
            // the answer that arrives on day one. The GitHub check is the opposite --
            // definitive when it answers -- and the backend refuses a confirmation
            // there, so offering one would be an affordance whose only outcome is an
            // error.
            step.selfConfirmable && (
              <Button variant="secondary" size="sm" onClick={onConfirm} loading={pending}>
                I&apos;ve done this
              </Button>
            )
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * How this hire's step was established, said plainly.
 *
 * The hire's own word is attributed to them rather than presented as something the system knows.
 * That difference is the whole reason rigor is stored, and hiding it here would put it back.
 */
function SettledNote({ step }: { step: ArrivalStep }) {
  return (
    <p className="mt-1 text-xs text-app-text-muted">
      {step.rigor === "OBSERVED" ? "Confirmed automatically" : "You marked this done"}
    </p>
  );
}

/**
 * The subtitle: what is known, never one figure standing for all of it.
 *
 * Counts are named by *how* they were established precisely so they cannot be read as a single
 * score. When everything is settled there is nothing left to count, so it says so instead.
 */
function summarise({
  observed,
  declared,
  outstanding,
}: {
  observed: number;
  declared: number;
  outstanding: number;
}): string {
  if (outstanding === 0) {
    return "Nothing outstanding";
  }

  const settled = [
    observed > 0 ? `${observed} confirmed` : null,
    declared > 0 ? `${declared} you told us about` : null,
  ].filter(Boolean);

  return [`${outstanding} still to do`, ...settled].join(" · ");
}
