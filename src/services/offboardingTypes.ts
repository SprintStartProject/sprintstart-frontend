/**
 * What a departure does to one file: nobody who knows it is left (`ORPHANED`), or exactly one person
 * is, so the next departure orphans it (`HOARDED`).
 */
export type RiskLevel = "ORPHANED" | "HOARDED";

/** The settings a ranking was computed with. */
export interface RiskSettings {
  halfLifeDays: number;
  inactiveAfterDays: number;
  authorThreshold: number;
  knowledgeWeight: number;
  activityWeight: number;
  /** What the weight profile is called. */
  name: string;
  /** How much each kind of evidence counted, such as `commits` and `reviews`. */
  sourceWeights: Record<string, number>;
  /** How the files were put in order; maps stored before there was a choice used the departing share. */
  ranking?: RankingName;
  /** How who knows a file was decided; maps stored before there was a choice used authorship. */
  knowledge?: { model: KnowledgeModelName; knowsAtLeast: number; foundingBonus: number };
}

/** How the files at risk are put in order. */
export type RankingName = "departing-share" | "placeholder";

/** How to decide who knows a file. */
export type KnowledgeModelName = "authorship" | "time-weighted";

/** How many files fall in each class; `listed` is how many of the at-risk files `files` carries. */
export interface RiskSummary {
  files: number;
  orphaned: number;
  hoarded: number;
  alreadyOrphaned: number;
  listed: number;
}

/** One file at risk, with the measures that put it there. */
export interface FileRisk {
  repository: string;
  path: string;
  level: RiskLevel;
  score: number;
  /** The leaving people's share of the file's evidence, from 0 to 1. */
  departingShare: number;
  /** That share for each kind of evidence on the file. */
  sourceBreakdown: Record<string, number>;
  recentActivity: number;
  fragmentation: number;
  /** How unevenly the knowledge is spread; maps stored before it was measured have none. */
  concentration?: Concentration | null;
  /** How complicated and how often changed the file is against the others, from 0 to 1; none when its complexity was never measured. */
  hotspot?: number | null;
  /** What the file holds; none when it was never measured. */
  kind?: FileKind | null;
  /** The provisional score of the team's metric selection, from 0 to 1; maps stored before it was measured have none. */
  placeholderScore?: number | null;
  /** The share of the lines written by people who are leaving or have left, from 0 to 1; none when never blamed. */
  abandonedShare?: number | null;
  /** The files that change together with this one; maps stored before it was measured have none. */
  coupling?: Coupling | null;
  /** People who know the surroundings of the file and could take it over, best first. */
  successors?: Successor[];
  /** Plain sentences that say why the file is on the map; they name nobody. */
  reasons?: string[];
  /** The people who stay and still know the file; at most one. */
  remainingKnowers: string[];
  lastChangedAt: string;
}

/** A file that tends to change in the same commits as another, and how strongly, from 0 to 1. */
export interface CoupledFile {
  repository: string;
  path: string;
  degree: number;
}

/** The files that change together with a file. */
export interface Coupling {
  sum: number;
  /** The most strongly coupled files, strongest first. */
  partners: CoupledFile[];
}

/** A person who could take a file over. */
export interface Successor {
  person: string;
  score: number;
}

/** How unevenly the knowledge of a file is spread over people. */
export interface Concentration {
  /** How many equally strong knowers the spread is worth. */
  effectiveKnowers: number;
  /** The person who holds almost all of the knowledge, if one does. */
  island: string | null;
}

/** The risk map of a simulated departure. */
export interface RiskMap {
  asOf: string;
  settings: RiskSettings;
  departing: string[];
  /** Leaving people no recorded change belongs to, usually a mistyped or differently spelled identity. */
  unknownDeparting: string[];
  summary: RiskSummary;
  files: FileRisk[];
}

/** A departure to simulate. */
export interface RiskQuery {
  /** The leaving people, each an email or a GitHub login. */
  leaving: string[];
  /** Replay the departure as of this moment instead of now. */
  asOf?: string;
  /** Let reviews count with this weight next to commits; left out, reviews are not used. */
  reviewWeight?: number;
  /** How much documentation pages count next to commits; left out, the server's default of 1, 0 leaves them out. */
  pageEditWeight?: number;
  /** Let the people behind the tickets commits name count with this weight; left out, tickets are not used. */
  ticketWeight?: number;
  /** How to order the files; left out, by the departing share. */
  ranking?: RankingName;
  /** How to decide who knows a file; left out, by authorship. */
  knowledge?: KnowledgeModelName;
  /** How many files to list. */
  limit?: number;
}

/** An identity the evidence names, such as a commit email or a GitHub login. */
export interface SeenIdentity {
  /** The email or login as the evidence recorded it. */
  identity: string;
  /** Who it counts as once the confirmed links are applied. */
  person: string;
  /** How many traces each kind of evidence holds for it. */
  touches: Record<string, number>;
  lastSeenAt: string;
}

/** A confirmed link: `alias` counts as `person`. */
export interface AliasLink {
  alias: string;
  person: string;
}

/**
 * A registered member of the project and the identities in the evidence that are theirs.
 * A member with none (`matched` is false) cannot be ranked.
 */
export interface MemberMatch {
  member: string;
  displayName: string;
  githubLogin: string | null;
  matched: boolean;
  identities: SeenIdentity[];
  /** Links that would make the member's identities count as one person, for a manager to confirm. */
  suggestions: AliasLink[];
  /** Whether they left no trace for so long that the ranking already counts them as gone. */
  inactive?: boolean;
  /** When they last left a trace under any identity. */
  lastSeenAt?: string | null;
}

/** The project's members, and how many of them the evidence can be attributed to. */
export interface MembersOverview {
  matched: number;
  total: number;
  members: MemberMatch[];
}

/** What a stored risk map is, without its ranking. */
export interface SnapshotSummary {
  id: string;
  label: string | null;
  computedAt: string;
  asOf: string;
  departing: string[];
  profileName: string;
  files: number;
  orphaned: number;
  hoarded: number;
}

/** A stored risk map with its ranking. */
export interface Snapshot {
  snapshot: SnapshotSummary;
  map: RiskMap;
}

/** Where one file stands in each of two rankings; a side that does not list it has no values. */
export interface FileMovement {
  repository: string;
  path: string;
  leftRank: number | null;
  rightRank: number | null;
  leftScore: number | null;
  rightScore: number | null;
  leftLevel: RiskLevel | null;
  rightLevel: RiskLevel | null;
}

/** How far the rankings of two stored risk maps agree. */
export interface SnapshotComparison {
  left: SnapshotSummary;
  right: SnapshotSummary;
  onlyLeft: number;
  onlyRight: number;
  both: number;
  /** Share of the union of both top lists that is in both, from 0 to 1. */
  topOverlap: number;
  /** Spearman's correlation of the shared files, from -1 to 1; none when fewer than two are shared. */
  rankCorrelation: number | null;
  movements: FileMovement[];
}

/** Every stored risk map with its ranking and every person pseudonymised, for the study. */
export interface StudyExport {
  exportedAt: string;
  snapshots: { id: string; computedAt: string; map: RiskMap }[];
}

/** What a file holds: source code, written text such as documentation pages, or settings. */
export type FileKind = "CODE" | "PROSE" | "CONFIG";

/** What an interview question tries to learn from the leaver. */
export type InterviewQuestionType = "rationale" | "operational" | "gotcha" | "handover";

/** How much of a question the project's records already answer. */
export type InterviewCoverage = "open" | "partial" | "answered";

/** One question of an interview plan, with what the records already say about it. */
export interface InterviewQuestion {
  /** The repository and directory it is about. */
  component: string;
  text: string;
  type: InterviewQuestionType;
  /** The findings of the risk map that make it worth asking. */
  triggers: string[];
  files: string[];
  priority: number;
  coverage: InterviewCoverage;
  recordAnswer: string | null;
  sources: string[];
}

/** The questions only the leaving people can answer, most urgent first. */
export interface InterviewPlan {
  questions: InterviewQuestion[];
  /** Questions the project's records already answer, so they are not asked. */
  answeredByRecords: InterviewQuestion[];
  /** How many files at risk the plan was made from. */
  files: number;
}
