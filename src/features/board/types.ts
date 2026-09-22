import type { ArrivalStep } from "../arrival/types";
import type { StepStatus } from "../onboarding/types";

/**
 * The board: a hire's persistent working surface on one project.
 *
 * The card catalog is closed. A card is a request to show a *known* read, never prose the
 * model wrote about the hire's state.
 */

/** Every card kind the board understands. Closed set — see the module comment. */
export type BoardCardKind =
  | "PATH_TO_FIRST_CONTRIBUTION"
  | "ARRIVAL_STEPS"
  | "OPEN_PULL_REQUESTS"
  | "CURRENT_TASK"
  | "SUGGESTED_TASKS"
  | "COMPETENCY_PROGRESS"
  | "MEMORY_RECAP"
  | "DIAGRAM"
  | "PATH_STEP"
  | AuthoredCardKind;

/**
 * The kinds the hire writes themselves.
 *
 * The only ones with content the board did not read from anywhere, the only ones a board may hold
 * several of, and the only ones the hire may edit.
 */
export type AuthoredCardKind = "NOTE" | "LINK" | "CHECKLIST";

/**
 * Who a card belongs to, which is what decides who may change it.
 *
 * `AI` means placed *for* the hire rather than by them: dismissible, never edited, because its
 * content is a live read. `HIRE` cards are theirs, and the mentor never removes one.
 */
export type BoardCardOwner = "AI" | "HIRE";

/** The moments a path card reports, in the order they normally happen. */
export type BoardMomentKey =
  "JOINED" | "TASK_CLAIMED" | "WORK_SUBMITTED" | "FIRST_RESPONSE" | "WORK_ACCEPTED";

/** One moment, and whether it has happened. `null` is "not yet", and renders as a dash, never a zero. */
export type BoardMoment = {
  key: BoardMomentKey;
  reachedAt: string | null;
};

/**
 * The path from joining to a first accepted piece of work.
 *
 * Composed from contributions, not pull requests, so it says something true whatever produces
 * this hire's work.
 */
export type PathToFirstContributionContent = {
  kind: "PATH_TO_FIRST_CONTRIBUTION";
  moments: BoardMoment[];
  acceptedCount: number;
  /** When onboarding ended, dated. Null while it is still going. */
  autonomyReachedAt: string | null;
  /** Why the hire currently reads as stalled, in plain words; null when they do not. */
  stalledReason: string | null;
};

/** One open pull request. `waitingHours` is null once somebody has responded — the clock stopped. */
export type BoardPullRequest = {
  artifactId: string;
  number: number | null;
  title: string | null;
  url: string | null;
  waitingHours: number | null;
};

/**
 * What still has to be true before this hire can work, and what they have already settled.
 *
 * The counts are per rigor and there is no total to divide by. A step the system observed
 * and a step somebody ticked are different facts. Render what is known — *"2 confirmed · 1 you told
 * us · 3 outstanding"* — never a percentage or a bar.
 */
export type ArrivalStepsContent = {
  kind: "ARRIVAL_STEPS";
  steps: ArrivalStep[];
  observedCount: number;
  declaredCount: number;
  outstandingCount: number;
};

/**
 * The hire's still-open pull requests, longest-waiting first.
 *
 * Only ever present on a board whose track admits pull requests — never rendered empty for
 * somebody who will never have one.
 */
export type OpenPullRequestsContent = {
  kind: "OPEN_PULL_REQUESTS";
  pullRequests: BoardPullRequest[];
  /**
   * The hire has declared no GitHub login, so nothing can be attributed to them.
   *
   * Distinct from an empty list: "you have nothing open" and "I cannot tell what you have
   * open" are different states, and only one is the hire's to fix.
   */
  attributionMissing: boolean;
};

/**
 * The task the hire is on, or the fact that they are on none.
 *
 * Present-but-empty when there is no task, never absent — a card that vanishes when a goal is
 * cleared reads as the board losing something.
 */
export type CurrentTaskContent = {
  kind: "CURRENT_TASK";
  taskId: string | null;
  title: string | null;
  summary: string | null;
  url: string | null;
  /** True when the hire claimed this as their goal, false when it is the Task 0 they were handed. */
  chosen: boolean;
  /**
   * True once the issue behind this task is closed where it lives. False when there is no task at
   * all, which says nothing about anything.
   */
  closedAtSource: boolean;
};

/** One suggested task, with the plain reasons it was suggested. Never a score. */
export type BoardSuggestedTask = {
  taskId: string;
  title: string;
  url: string | null;
  reasons: string[];
};

/** Good next tasks, ranked by fit. Reasons only, never a score. */
export type SuggestedTasksContent = {
  kind: "SUGGESTED_TASKS";
  tasks: BoardSuggestedTask[];
};

/** One competency, with the bar it is measured against — never a score out of a hundred. */
export type BoardCompetency = {
  competencyKey: string;
  label: string;
  level: number;
  targetLevel: number;
};

/**
 * What the hire has shown they can do, and what they are short of.
 *
 * Two lists, never a percentage. Level-0 rows never appear — that value means "asked, saw no
 * evidence".
 */
export type CompetencyProgressContent = {
  kind: "COMPETENCY_PROGRESS";
  held: BoardCompetency[];
  inProgress: BoardCompetency[];
};

/**
 * What the mentor remembers about the hire, in the mentor's own words.
 *
 * The one card whose content a model wrote, which is why it is labelled as such rather than shown
 * as a fact about the hire. `memory` is null before the first visit has been folded.
 */
export type MemoryRecapContent = {
  kind: "MEMORY_RECAP";
  memory: string | null;
  /** How many messages the memory covers — the honest measure of how much it is working from. */
  messagesRemembered: number;
};

/** What a box is. `OTHER` is the honest answer when the evidence does not settle it. */
export type DiagramNodeKind =
  "COMPONENT" | "FILE" | "SERVICE" | "DATA" | "STEP" | "EXTERNAL" | "OTHER";

/** How two boxes relate. `RELATES_TO` means connected in a way the evidence does not name. */
export type DiagramEdgeKind = "FLOWS_TO" | "DEPENDS_ON" | "CONTAINS" | "RELATES_TO";

/** Where a box came from. A source with no URL is still named: unopenable beats unattributed. */
export type DiagramCitation = {
  filename: string;
  sourceUrl: string | null;
};

/**
 * One box.
 *
 * `citations` is what separates a diagram from a drawing — every box asserts this project contains
 * this part, and the citation is how a reader checks it. Never empty: an ungrounded box is dropped
 * server-side rather than shown unsourced.
 */
export type DiagramNode = {
  id: string;
  label: string;
  kind: DiagramNodeKind;
  summary: string | null;
  citations: DiagramCitation[];
};

/** One arrow. Both ends name a box in the same diagram. */
export type DiagramEdge = {
  fromId: string;
  toId: string;
  kind: DiagramEdgeKind;
  label: string | null;
};

export type DiagramSource = {
  filename: string;
  sourceUrl: string | null;
  artifactType: string | null;
};

/**
 * A picture of how some part of the project fits together.
 *
 * The card that carries the one extension the board's rules ever got: the buddy may choose the
 * question, it never writes the answer. `subject` is the mentor's — only the conversation knows
 * what was just being explained — and every box is derived from the project's own material, one
 * citation each.
 *
 * `assembledAt` is not decoration. The board serves the picture last drawn rather than waiting on
 * one to be redrawn, so this is a claim about the code as it was at a moment, and the reader is
 * entitled to know which. Null means it has never been drawn.
 *
 * An empty `nodes` with a `reason` is an ordinary state: the project may have nothing to say about
 * this subject. An empty diagram is never dressed up as an explanation.
 */
export type DiagramContent = {
  kind: "DIAGRAM";
  subject: string;
  summary: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  sources: DiagramSource[];
  assembledAt: string | null;
  reason: string | null;
};

/** One task of a path step, as the path itself holds it. */
export type PathStepTask = {
  id: string;
  stepId: string;
  position: number;
  title: string;
  description: string;
  finished: boolean;
};

/** One resource of a path step, as the path itself holds it. */
export type PathStepResource = {
  id: string;
  stepId: string;
  title: string;
  description: string;
  url: string;
};

/**
 * The hire's current step of their onboarding path, live.
 *
 * The one card in the catalog that is `AI`-owned and still partly the hire's to change: everything
 * here is a read straight from the path, except the tick on a task, which writes back to the path
 * itself and never to the board. That is also why almost every field is nullable — the path can be
 * regenerated out from under a card that is still sitting on the board, and a step that no longer
 * exists is not an error, it is `reason` explaining why the rest went quiet.
 */
export type PathStepContent = {
  kind: "PATH_STEP";
  stepId: string | null;
  phaseTitle: string | null;
  title: string | null;
  description: string | null;
  status: StepStatus | null;
  isAiAssisted: boolean;
  expectedOutcomes: string[];
  tasks: PathStepTask[];
  resources: PathStepResource[];
  /** Why the step behind this card is gone, e.g. no longer on the hire's path. Null while it holds. */
  reason: string | null;
};

/**
 * What to call a `PATH_STEP` card when the step behind it did not come with a `title`.
 *
 * Shared between the card's own frame title (`PathStepCard`) and `cardName` so the two cannot
 * drift into saying two different things for the same untitled step.
 */
export const PATH_STEP_FALLBACK_TITLE = "A step of your path";

/** Something the hire wrote down, in markdown. Theirs — never quoted back as fact. */
export type NoteContent = {
  kind: "NOTE";
  text: string;
};

/** A link the hire kept. A null `label` means show the URL: worse to read, but always true. */
export type LinkContent = {
  kind: "LINK";
  url: string;
  label: string | null;
};

/** One checklist item, identified so ticking it is an edit to the line and not to a position. */
export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

/** A list the hire ticks off — the only card whose content changes by being used. */
export type ChecklistContent = {
  kind: "CHECKLIST";
  title: string | null;
  items: ChecklistItem[];
};

/** The rendered content of one card, discriminated by `kind`. */
export type BoardCardContent =
  | PathToFirstContributionContent
  | ArrivalStepsContent
  | OpenPullRequestsContent
  | CurrentTaskContent
  | SuggestedTasksContent
  | CompetencyProgressContent
  | MemoryRecapContent
  | DiagramContent
  | PathStepContent
  | NoteContent
  | LinkContent
  | ChecklistContent;

/**
 * What the hire wants a card of theirs to say.
 *
 * The same shape creates and edits, because an edit replaces the content outright — a patch
 * language for a three-line note would be more machinery than the note. A new checklist item has no
 * `id`; the server mints one, so two tabs adding a line cannot mint the same one.
 */
export type AuthoredCardRequest =
  | { kind: "NOTE"; text: string }
  | { kind: "LINK"; url: string; label?: string | null }
  | {
      kind: "CHECKLIST";
      title?: string | null;
      items: { id?: string; text: string; done: boolean }[];
    };

export type BoardCard = {
  id: string;
  kind: BoardCardKind;
  owner: BoardCardOwner;
  position: number;
  /**
   * When the buddy put this card here; null when the board keeps it as part of the baseline.
   *
   * Drives the attribution line, and only this decides it. "Your buddy added this" about a card
   * nobody chose is attribution the hire cannot check, and attribution they cannot check is
   * attribution they cannot trust.
   */
  placedAt: string | null;
  content: BoardCardContent;
};

export type Board = {
  boardId: string;
  projectId: string; /** Active cards only, in board order — a dismissed card is gone from the hire's point of view. */
  cards: BoardCard[];
};
