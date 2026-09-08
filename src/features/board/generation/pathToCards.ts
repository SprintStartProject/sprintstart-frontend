import type { OnboardingPathEndpoint, OnboardingStepEndpoint } from "../../onboarding/types";
import type { AuthoredCardRequest } from "../types";
import type { BoardStage, DependencySource } from "../layout/boardStructure";

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
 * How a phase's position maps onto the board's two stages.
 *
 * A path has as many phases as it needs; the board has two coarse buckets, on purpose — see
 * `boardStructure.ts`. The first phase is what the hire does now, everything after it is later.
 * The finer order survives inside the areas, which keep the phases' own names and sequence, and in
 * the chains between the steps of a phase.
 */
export function stageForPhase(index: number): BoardStage {
  return index === 0 ? "NOW" : "LATER";
}

/** One card to create, and where it belongs once it exists. */
export type PlannedCard = {
  /** A key for this plan only — the real id is minted by the server on creation. */
  key: string;
  request: AuthoredCardRequest;
  /**
   * When this card is due.
   *
   * Per card rather than per area, because the two are different questions and only one of them is
   * a place. An area is where a card is filed — "Week one", "From your team" — and a stage is when
   * it comes up; a team's blueprints are one named set of cards that deliberately spans all three
   * stages. Carrying the stage on the area forced that set to be split into three areas with three
   * tab stops, which is a table of contents describing the sequencing rather than the board.
   */
  stage: BoardStage;
  /** The key of the card that must be finished first, or null for the first of a phase. */
  afterKey: string | null;
};

/** One named area of cards, as a plan would file them. */
export type PlannedArea = {
  name: string;
  cards: PlannedCard[];
  /**
   * Who is claiming the chains in this area — the team, through a blueprint, or the buddy, through
   * a generated path.
   *
   * Carried on the area rather than on each card because it is a property of where the plan came
   * from, and one plan's areas never mix the two. It ends up on the board as the source of every
   * dependency the area writes, which is what stops a hire from clearing a rule their PM wrote and
   * what lets a buddy's suggestion say whose it was.
   */
  source: DependencySource;
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

/**
 * The title as stored: marked with where it came from.
 *
 * **Trimmed, because the server trims.** A blueprint whose title a PM typed with a trailing space,
 * or a path step the AI service handed over with a newline on the end, is stored without it — and a
 * later run that planned the untrimmed string would find no card by that name and write a second
 * one. Trimming here is the cheap half of that fix; {@link titleKey} is the half that holds when
 * something else in the round trip changes the string.
 */
export function markTitle(source: GeneratedSource, title: string): string {
  return `${CARD_SOURCE_MARKERS[source]}${title.trim()}`;
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
 * What makes two cards the same card, for the purpose of not writing one twice.
 *
 * A generation run skips anything already on the board, and it can only recognise its own work by
 * the title — so the comparison has to survive everything that happens to a title between being
 * planned and being read back. It is trimmed and its inner runs of whitespace are collapsed,
 * because the server stores a trimmed string and nobody can see the difference between one space
 * and two. It is lowercased, because a card that differs from another only in capitalisation is a
 * duplicate to the person reading the board, whatever a string comparison thinks.
 *
 * **The marker comes off.** A step of the hire's path and a blueprint their PM wrote can name the
 * same piece of work, and the board would carry both as two cards with one visible title and no way
 * to tell them apart. Keyed on what the hire reads, the second one is recognised as already there —
 * and since blueprints are planned first, the version that survives is the one a person wrote.
 */
export function titleKey(title: string | null): string {
  if (title === null) return "";

  return readableTitle(title).trim().replace(/\s+/g, " ").toLowerCase();
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
      stage: stageForPhase(phaseIndex),
      afterKey: stepIndex === 0 ? null : steps[stepIndex - 1].id,
    }));

    if (cards.length > 0) areas.push({ name: phase.title, cards, source: "BUDDY" });
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
