/**
 * Whether a task is in the claimable pool.
 *
 * `PROPOSED` is gone: a mined task is live the moment it is mined, and `reviewed` says whether
 * anybody has looked at it. `REJECTED` is terminal *and sticky* — mining never brings back a task
 * somebody turned down.
 */
export type ProposalStatus = "LIVE" | "REJECTED";

/**
 * An AI-mined starter task (a GitHub issue) a hire can be pointed at.
 *
 * It is claimable on arrival — review is not a gate any more. What review buys is rank: fit-ranking
 * demotes an unreviewed task, capped below the smallest positive signal, so one that fits a hire
 * perfectly still beats a reviewed one that does not.
 */
export type StarterWorkTask = {
  id: string;
  sourceId: string;
  title: string;
  summary: string | null;
  /** The AI's scope-safety judgement: why this is a reasonable first task. */
  rationale: string | null;
  sourceUrl: string | null;
  /** Competencies the AI judged this task exercises; one of the signals fit-ranking reads. */
  competencyKeys: string[];
  status: ProposalStatus;
  /** Whether a person has looked at this task. Unreviewed is claimable, just ranked lower. */
  reviewed: boolean;
  /** Which track this work is for, or null when it suits any role. */
};

/** The live tasks nobody has vouched for yet. */
export type UnreviewedStarterWork = {
  tasks: StarterWorkTask[];
};

/**
 * What a PM sends to hand-author a starter task, with no AI mining.
 *
 * The origination counterpart to mining. A hand-authored task comes back already reviewed — writing
 * it *is* the review — so it carries no unvouched demotion and never appears in the unreviewed
 * list. `sourceUrl` is an optional link to the issue or PR it tracks; `competencyKeys` say what the
 * work exercises, and a key that isn't a live competency is skipped, not rejected.
 */
export type CreateStarterWorkTaskInput = {
  title: string;
  summary?: string;
  sourceUrl?: string;
  competencyKeys?: string[];
};

/**
 * Whether a browsable corpus issue is already in the pool, and how it got there.
 *
 * Describes the pool, never the issue's suitability — nothing here ranks anything. It lets the
 * browser say *why* an issue is not offered instead of leaving it out, so a reader can tell
 * "filtered" from "never ingested".
 *
 * `REMOVED` must stay visible: rejection is sticky, so a removed issue cannot be put back, and
 * showing it as absent would send somebody hunting for it.
 */
export type CandidatePoolState = "AVAILABLE" | "IN_POOL" | "REMOVED";

/**
 * One open issue the corpus already holds, offered for a person to put in the pool themselves.
 *
 * Nothing has judged this. There is no score and no suitability field, and neither may be
 * added — the judgement is the reader's.
 *
 * `hasAssignee` is three-valued and null means we do not know, never "nobody" — SprintStart does
 * not ingest GitHub assignees, so every GitHub issue reports null. Only `true` means somebody is on
 * it. `excerpt` is the issue's own text cut to a list-sized length, with `excerptTruncated` saying
 * when something was cut, so a partial body is never mistaken for a short one.
 */
export type StarterWorkCandidate = {
  sourceId: string;
  /** Which tracker it came from — `GITHUB`, `JIRA`. */
  tracker: string;
  title: string;
  excerpt: string | null;
  excerptTruncated: boolean;
  labels: string[];
  sourceUrl: string | null;
  hasAssignee: boolean | null;
  poolState: CandidatePoolState;
  /** ISO timestamp of the issue's last change at its source, or null when it never said. */
  updatedAtSource: string | null;
};

/**
 * What a PM sends to put one browsed issue in the pool.
 *
 * The title and link come from the ingested issue, not from here, so the pool cannot disagree with
 * the tracker about what an issue is called. `summary` is the promoter's own note — the issue's
 * body is not copied, because orientation reads that text live from the corpus and a copy would
 * go stale.
 */
export type PromoteStarterWorkCandidateInput = {
  sourceId: string;
  summary?: string;
  competencyKeys?: string[];
  /** Which track this work is for. Omitted means it suits any role. */
};

export type GenerateStarterWorkResult = {
  status: string;
  tasksProposed: number;
  notes: string[];
};

/** What kind of work a task is, read off the issue's own labels. `OTHER` means unknown. */
export type TaskType = "BUG" | "FEATURE" | "DOCS" | "TEST" | "CHORE" | "OTHER";

/**
 * One task from the live pool, ranked for a hire.
 *
 * `reasons` is the important field. Ranking is a *suggestion*, and a suggestion nobody can
 * interrogate is an instruction — so the backend sends one clause per contributing signal,
 * strongest first, with any "you may wait for a review here" note last. An empty list means
 * nothing matched, which is worth saying plainly rather than dressing up.
 */
export type RankedStarterWorkTask = {
  task: StarterWorkTask;
  score: number;
  /** The hire's competencies that overlap this task's requirements. */
  matchedCompetencyKeys: string[];
  taskType: TaskType;
  reasons: string[];
};

/**
 * The starter task a hire has committed to on a project.
 *
 * It named a `CONTRIBUTION` competency and how many of its prerequisites were still outstanding.
 * Both went with the graph: a goal points at the task, and there is no ordering left to be short
 * of. Claiming happens in conversation with the buddy, so nothing in this app reads one yet.
 */
export type Goal = {
  proposalId: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
};
