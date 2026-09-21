import { Check, ExternalLink } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Marked } from "../../board/components/Marked";
import type { CardMark } from "../../board/marks/cardMarks";
import { groupByScope } from "../scopeGroups";
import { safeStepHref } from "../stepHref";
import type { ArrivalStep } from "../types";

/**
 * The read-and-optionally-write rendering of an arrival list: grouped by scope, one row per step.
 *
 * Pulled out of the board card so the same rendering can sit in a read-only preview drawer without
 * that drawer reimplementing headings, links and the settled/pending/failed states of a row. The
 * board card is still the only place a hire can actually confirm a step — `onConfirm` left out
 * turns every row read-only, which is what the preview wants.
 */
export function ArrivalStepList({
  steps,
  marks = [],
  cardId,
  pendingKey = null,
  failedKey = null,
  onConfirm,
}: {
  steps: ArrivalStep[];
  /** The card's highlights, matched by their words — left out where there is no card to point at. */
  marks?: CardMark[];
  cardId?: string;
  pendingKey?: string | null;
  failedKey?: string | null;
  /** Omitted for a read-only rendering, e.g. the arrival preview drawer's example states. */
  onConfirm?: (step: ArrivalStep) => void;
}) {
  // Headings only earn their space once there is more than one scope. A lone "Everyone" over a
  // list that is entirely company-wide -- the normal case -- is a label saying nothing.
  const groups = groupByScope(steps);
  const showScopeHeadings = groups.length > 1;

  return (
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
              <ArrivalStepRow
                key={step.key}
                step={step}
                marks={marks}
                cardId={cardId}
                pending={pendingKey === step.key}
                failed={failedKey === step.key}
                onConfirm={onConfirm ? () => onConfirm(step) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * One step: what it is, whether it is settled, and — when it is the hire's to settle — the way to
 * say so.
 */
function ArrivalStepRow({
  step,
  marks,
  cardId,
  pending,
  failed,
  onConfirm,
}: {
  step: ArrivalStep;
  marks: CardMark[];
  cardId?: string;
  pending: boolean;
  failed: boolean;
  onConfirm?: () => void;
}) {
  const href = safeStepHref(step.href);

  return (
    <li
      className={`rounded-xl border p-3 ${
        step.settled ? "border-app-border bg-app-surface-muted/40" : "border-app-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm ${step.settled ? "text-app-text-muted" : "text-app-text"}`}>
            <Marked text={step.title} marks={marks} cardId={cardId} />
          </p>
          {step.description && (
            <p className="mt-1 text-xs text-app-text-muted">
              <Marked text={step.description} marks={marks} cardId={cardId} />
            </p>
          )}
          {step.settled && <SettledNote step={step} />}
          {failed && (
            <p className="mt-1 text-xs text-app-danger-text">
              That didn&apos;t save. Try again in a moment.
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* `safeStepHref`, not `step.href`: the link is free text an author typed, and it
              lands on somebody else's board. A step whose link does not survive the check
              simply renders without one — a step nobody can open is better than an anchor
              that runs whatever was pasted into it. */}
          {href && !step.settled && (
            <a
              href={href}
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
            // error. `onConfirm` is also left out entirely for a read-only rendering.
            step.selfConfirmable &&
            onConfirm && (
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
