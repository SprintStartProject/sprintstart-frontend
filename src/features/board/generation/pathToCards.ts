import type { OnboardingPathEndpoint, OnboardingStepEndpoint } from "../../onboarding/types";
import type { AuthoredCardRequest } from "../types";
import type { BoardStage } from "../layout/boardStructure";

/**
 * Turning the hire's personalised onboarding path into cards on their board.
 *
 * The path already exists and is already personalised: the AI service drafts it from the project's
 * own corpus, against blueprints a PM maintains, and it comes back as phases of steps of tasks. The
 * board did not know about any of it — which left the hire with a to-do list on one page and a
 * working surface on another, and nothing saying which of the two was the plan.
 *
 * So the board becomes where the path is *worked*, and the path stays where it is generated. One
 * step is one checklist card, its tasks are the lines on it, and the phase it came from is the area
 * the card sits in. Nothing here writes prose: every title and every line is text the path already
 * carried, so a card can be checked against the step it came from.
 *
 * TODO(backend): the cards this produces are posted through the ordinary authored-card endpoint, so
 * they come back owned by the hire rather than attributed to the buddy. That is right for editing —
 * they are the hire's list to tick, re-word and prune — and wrong for provenance, since a hire
 * cannot tell a card they wrote from one their path generated. A `POST /me/board/cards/from-path`
 * that mints them `AI`-owned with `placedAt` set, and still editable, is the shape this wants;
 * until then {@link CARD_SOURCE_MARKERS} is the only trace, and it is deliberately never shown.
 */

/**
 * Steps whose contents are worth a card.
 *
 * A step already finished is a card that arrives ticked, which is a card that arrives as noise; a
 * skipped one was explicitly declined. Both stay on the path page, where their history belongs.
 */
const CARD_WORTHY: readonly OnboardingStepEndpoint["status"][] = ["WAITING", "IN_PROGRESS"];

/**
 * How a phase's position maps onto the board's three stages.
 *
 * A path has as many phases as it needs; the board has three coarse buckets, on purpose — see
 * `boardStructure.ts`. The first phase is what the hire does now, the second is what is coming, and
 * everything beyond that is later. The finer order survives inside the areas, which keep the
 * phases' own names and sequence.
 */
export function stageForPhase(index: number): BoardStage {
  if (index === 0) return "NOW";
  if (index === 1) return "NEXT";

  return "LATER";
}

/** One card to create, and where it belongs once it exists. */
export type PlannedCard = {
  /** A key for this plan only — the real id is minted by the server on creation. */
  key: string;
  request: AuthoredCardRequest;
  /** The key of the card that must be finished first, or null for the first of a phase. */
  afterKey: string | null;
};

/** One phase, as an area of cards. */
export type PlannedArea = {
  name: string;
  stage: BoardStage;
  cards: PlannedCard[];
};

export type CardPlan = {
  areas: PlannedArea[];
  /** How many cards the whole plan would create, for the confirmation the hire is shown. */
  cardCount: number;
};

/**
 * Where a generated checklist came from, written invisibly into its title.
 *
 * Two jobs, both of which want a `source` column and do not have one. A second generation run has
 * to recognise what the first one made so it does not create it twice; and the board's provenance
 * filter has to tell a card the *team* prescribed from one the hire's own path produced — "from
 * your team" is a real distinction to a new hire, and it is invisible in a checklist that looks
 * exactly like every other checklist.
 *
 * Zero-width characters at the front of the title: they never render, never affect a comparison the
 * hire can see, and survive the authored-card round trip because the title is stored verbatim.
 * {@link readableTitle} takes them off everywhere a person reads one.
 *
 * TODO(backend): this is a channel smuggled through a text field, and it should not outlive the
 * endpoint in the note above. A `source` on the card row — `HIRE` / `PATH` / `BLUEPRINT` — carries
 * the same fact without encoding it in something the hire can edit. When that lands, delete every
 * marker here and read the field.
 */
export const CARD_SOURCE_MARKERS = {
  /** U+2063 invisible separator: a step of the hire's own personalised path. */
  PATH: "\u2063",
  /** U+2060 word joiner: a card blueprint the project's PM wrote for this role. */
  TEAM: "\u2060",
} as const;

export type GeneratedSource = keyof typeof CARD_SOURCE_MARKERS;

/** The title as stored: marked with where it came from. */
export function markTitle(source: GeneratedSource, title: string): string {
  return `${CARD_SOURCE_MARKERS[source]}${title}`;
}

/** Where a stored title came from, or null when the hire wrote it themselves. */
export function sourceOfTitle(title: string | null): GeneratedSource | null {
  if (title === null) return null;

  return (
    (Object.keys(CARD_SOURCE_MARKERS) as GeneratedSource[]).find((source) =>
      title.startsWith(CARD_SOURCE_MARKERS[source]),
    ) ?? null
  );
}

/** Whether a title was written by a generation run rather than by the hire. */
export function isGeneratedTitle(title: string | null): boolean {
  return sourceOfTitle(title) !== null;
}

/** The title as the hire reads it, with any marker taken off. */
export function readableTitle(title: string): string {
  const source = sourceOfTitle(title);

  return source === null ? title : title.slice(CARD_SOURCE_MARKERS[source].length);
}

/**
 * The cards a path would put on the board, in the order they should be worked.
 *
 * **Steps inside a phase are chained; phases are not.** The path gives its steps an explicit
 * position, so within a phase "this before that" is something the path actually claims and the
 * board can honour. Across phases it is the stage that carries the order — chaining there as well
 * would leave a hire with exactly one card they are allowed to open out of forty, which is a
 * different kind of unusable from the one this is fixing.
 *
 * A step with no tasks still becomes a card, its expected outcomes as the lines: a step the path
 * did not break down is still a thing to do, and an empty card at least says what it is for.
 */
export function planCardsFromPath(path: OnboardingPathEndpoint): CardPlan {
  const areas: PlannedArea[] = [];

  const phases = [...path.phases].sort((a, b) => a.position - b.position);
  phases.forEach((phase, phaseIndex) => {
    const steps = [...phase.steps]
      .sort((a, b) => a.position - b.position)
      .filter((step) => CARD_WORTHY.includes(step.status));

    const cards: PlannedCard[] = steps.map((step, stepIndex) => ({
      key: step.id,
      request: {
        kind: "CHECKLIST",
        title: markTitle("PATH", step.title),
        items: linesFor(step).map((text) => ({ text, done: false })),
      },
      afterKey: stepIndex === 0 ? null : steps[stepIndex - 1].id,
    }));

    if (cards.length > 0) {
      areas.push({ name: phase.title, stage: stageForPhase(phaseIndex), cards });
    }
  });

  return { areas, cardCount: areas.reduce((total, area) => total + area.cards.length, 0) };
}

/**
 * What goes on the checklist for one step.
 *
 * Tasks first, because they are the step broken into things somebody does. Failing that, the
 * expected outcomes — phrased as results rather than actions, but a hire ticking off "the project
 * builds locally" is still ticking off something true. Failing both, one line naming the step, so
 * the card is never a title over an empty box.
 */
function linesFor(step: OnboardingStepEndpoint): string[] {
  if (step.tasks.length > 0) {
    return [...step.tasks].sort((a, b) => a.position - b.position).map((task) => task.title);
  }
  if (step.expectedOutcomes.length > 0) return step.expectedOutcomes;

  return [step.title];
}
