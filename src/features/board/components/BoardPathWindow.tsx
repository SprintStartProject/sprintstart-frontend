import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, Milestone, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button.tsx";
import { phaseProgress, sortedPhases } from "../../onboarding/journey.ts";
import { resolveNextAction } from "../../onboarding/nextAction.ts";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace.ts";
import type { OnboardingPathEndpoint } from "../../onboarding/types.ts";

type BoardPathWindowProps = {
  /** The hire's path, or null while it loads and when there is none. */
  path: OnboardingPathEndpoint | null;
  /** Takes the card off this board altogether. The way back is the board's own rail. */
  onRemove: () => void;
  /**
   * Drawn at the foot of the card, under "Next": the phase check (`BoardPhaseCheck`). Inside the
   * card rather than beside it, so the rail's "show where you are" shows and hides both together —
   * the check closes the phase this card is about.
   */
  children?: ReactNode;
};

/**
 * Where the hire is in their path, as one card: the phase they are in, how far through it, and the
 * next thing in it. Pressing the card opens that phase on the Onboarding page; pressing the next
 * step opens the step.
 *
 * **The phase they are in, not the lowest open one.** This used to be a strip of the graph around
 * the first unfinished phase by position — and phases are not a queue: a hire who took another way
 * through stood in phase 7 while the board pointed at phase 2. It now asks `resolveNextAction`, the
 * same answer the Onboarding page gives to "continue": the phase being worked in, most recently
 * touched first.
 *
 * **A card, not a map.** The whole path has a page of its own; on the board the question is "where
 * am I and what is next", and that is one line of each.
 *
 * Silent when there is no path, which is an ordinary state rather than an error.
 */
export function BoardPathWindow({ path, onRemove, children }: BoardPathWindowProps) {
  if (!path || path.phases.length === 0) return null;

  const phases = sortedPhases(path);
  const next = resolveNextAction(path);

  const removeButton = (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-label="Take this off your board"
      title="Take this off your board"
      onClick={onRemove}
      className="relative z-10 shrink-0"
    >
      <X className="h-4 w-4" />
    </Button>
  );

  if (next.kind === "done" || next.kind === "choose") {
    return (
      <section
        aria-label="Where you are in your path"
        className="relative flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3 shadow-sm transition-colors hover:border-app-brand-border"
      >
        {next.kind === "done" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-app-success-text" aria-hidden="true" />
        ) : (
          <Milestone className="h-5 w-5 shrink-0 text-app-brand-text" aria-hidden="true" />
        )}
        <Link
          to="/onboarding"
          className="min-w-0 flex-1 text-sm font-medium text-app-text after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-app-focus"
        >
          {next.kind === "done"
            ? "Your path is done — every phase finished."
            : "Pick the phase you want to do next"}
        </Link>
        {removeButton}
      </section>
    );
  }

  const phase = next.phase;
  const progress = phaseProgress(phase);
  const number = phases.findIndex((candidate) => candidate.id === phase.id) + 1;
  const nextTitle =
    next.kind === "step" ? next.step.title : next.question.title || "A knowledge check";
  const nextUrl =
    next.kind === "step"
      ? onboardingPlaceUrl({ kind: "step", id: next.step.id })
      : `/onboarding?question=${encodeURIComponent(next.question.id)}`;

  return (
    <section
      aria-label="Where you are in your path"
      // The whole card is the way into the phase (the link's `after:` overlay); the next step and
      // the close button sit above that overlay, so each still does its own thing.
      className="relative space-y-2 rounded-2xl border border-app-border bg-app-surface px-4 py-3 shadow-sm transition-colors hover:border-app-brand-border"
    >
      <div className="flex items-start gap-3">
        <Milestone className="mt-0.5 h-5 w-5 shrink-0 text-app-brand-text" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-app-text-muted">
            You are in phase {number} of {phases.length}
          </p>
          <Link
            to={onboardingPlaceUrl({ kind: "phase", id: phase.id })}
            className="block truncate text-sm font-semibold text-app-text after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-app-focus"
          >
            {phase.title}
          </Link>
        </div>
        <span className="shrink-0 text-xs text-app-text-muted tabular-nums">
          {progress.completed} of {progress.total} done
        </span>
        {removeButton}
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-app-surface-muted"
        role="progressbar"
        aria-label={`${phase.title}: ${progress.percentage}% done`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percentage}
      >
        <div
          className="h-full rounded-full bg-app-brand transition-[width] duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm text-app-text-muted">
        <span>Next:</span>
        <Link
          to={nextUrl}
          className="relative z-10 inline-flex items-center gap-1 font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          {nextTitle}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </p>

      {children}
    </section>
  );
}
