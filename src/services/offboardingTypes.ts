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
}

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
}

/** The project's members, and how many of them the evidence can be attributed to. */
export interface MembersOverview {
  matched: number;
  total: number;
  members: MemberMatch[];
}
