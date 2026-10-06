import { ArrowRight, ClipboardCheck, Highlighter } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/ui/Badge";
import { resolveNextAction } from "../../onboarding/nextAction";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import { cardName } from "../layout/cardNames";
import type { CardOrigins } from "../layout/cardOrigins";
import { phaseOfCard, type PathPhases } from "../layout/pathStages";
import type { CardMarks } from "../marks/cardMarks";
import type { BoardCard } from "../types";

/** How many of the phase's cards are named before the rest becomes "and N more". */
const LISTED = 5;

type BoardPhaseCheckProps = {
  path: OnboardingPathEndpoint | null;
  phases: PathPhases | null;
  cards: readonly BoardCard[];
  origins: CardOrigins;
  marks: CardMarks;
  /**
   * Drawn inside the path card rather than as a box of its own: a rule above it instead of a
   * border around it, and above the card's own whole-card link so its buttons stay pressable.
   */
  embedded?: boolean;
};

/**
 * The phase check coming up, and what the hire kept that is about it.
 *
 * A phase ends in questions about what it covered, and the board is where the hire kept what they
 * found along the way — so this puts the two next to each other: how many questions are still open,
 * and the cards from this phase, the ones with something highlighted on them first. The board as a
 * cheat sheet for the check, which is the most concrete reason a hire has to keep anything at all.
 *
 * **Only while there is a check to prepare for.** No path, a phase without questions, or every
 * question passed: nothing is drawn. The cards are named in prose, like "next on your path", and
 * pressing one brings it into view rather than filtering the board to it.
 */
export function BoardPhaseCheck({
  path,
  phases,
  cards,
  origins,
  marks,
  embedded = false,
}: BoardPhaseCheckProps) {
  if (!path || !phases) return null;

  // The phase the hire is working in, as the Onboarding page and "next on your path" read it —
  // not the lowest open one, since several can be open at once.
  const next = resolveNextAction(path);
  if (next.kind !== "step" && next.kind !== "question") return null;
  const phase = next.phase;

  const open = [...(phase.questions ?? [])]
    .filter((question) => question.status !== "PASSED")
    .sort((left, right) => left.position - right.position);
  if (open.length === 0) return null;

  const total = (phase.questions ?? []).length;
  const kept = cards
    .filter(
      (card) =>
        card.content.kind !== "PATH_STEP" && phaseOfCard(card, phases, origins) === phase.id,
    )
    // Highlighted first: a card somebody marked up is a card they already decided mattered.
    .sort(
      (a, b) => Number((marks[b.id]?.length ?? 0) > 0) - Number((marks[a.id]?.length ?? 0) > 0),
    );
  const listed = kept.slice(0, LISTED);

  return (
    <section
      aria-label={`Phase check for ${phase.title}`}
      className={
        embedded
          ? "relative z-10 space-y-2 border-t border-app-border pt-2"
          : "space-y-2 rounded-2xl border border-app-border bg-app-surface px-4 py-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-app-brand-text" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-app-text">Phase check for {phase.title}</h2>
        <Badge variant="brand" size="sm">
          <span className="tabular-nums">
            {open.length} of {total} open
          </span>
        </Badge>
        <Link
          to={`/onboarding?question=${encodeURIComponent(open[0].id)}`}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-app-brand-text hover:underline"
        >
          Go to the check
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {kept.length === 0 ? (
        <p className="text-xs text-app-text-muted">
          Nothing kept from this phase yet. Notes and links you keep while one of its steps is open
          show up here.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-text-muted">
          <span>What you kept from it:</span>
          {listed.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() =>
                document
                  .querySelector(`[data-card-id="${CSS.escape(card.id)}"]`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="inline-flex items-center gap-1 font-medium text-app-text hover:underline"
            >
              {(marks[card.id]?.length ?? 0) > 0 && (
                <Highlighter className="h-3 w-3 text-app-warning-text" aria-label="Highlighted" />
              )}
              {cardName(card)}
            </button>
          ))}
          {kept.length > listed.length && (
            <Link
              to={`/board?phase=${encodeURIComponent(phase.id)}`}
              className="font-medium text-app-brand-text underline underline-offset-2"
            >
              and {kept.length - listed.length} more
            </Link>
          )}
        </p>
      )}
    </section>
  );
}
