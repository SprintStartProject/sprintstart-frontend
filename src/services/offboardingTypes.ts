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
  /** The people who stay and still know the file; at most one. */
  remainingKnowers: string[];
  lastChangedAt: string;
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
