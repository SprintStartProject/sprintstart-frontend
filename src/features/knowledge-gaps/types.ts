export interface KnowledgeGapOwner {
  id: string;
  username: string;
  firstname: string;
  lastname: string;
  // Project role of the owner, derived by the backend. May be absent.
  role?: string;
}

export type KnowledgeGapSeverity = "high" | "medium" | "low";

export interface KnowledgeGap {
  id: string;
  component: string;
  missingTypes: string[];
  // Document types the component already has. Provided by the AI; not always rendered yet.
  presentTypes?: string[];
  // When the component was last written into the AI index (most recent ingestion).
  lastIngested: string;
  // When the component was first ingested. May be null when it has no ingested artifacts.
  firstIngested?: string | null;
  // When this gap was last (re)analyzed by a knowledge-gaps refresh.
  refreshedAt: string;
  // Populated by the backend once component owners are assigned; empty until then.
  owners: KnowledgeGapOwner[];
  severity: KnowledgeGapSeverity;
}

export interface KnowledgeGapOverview {
  gaps: KnowledgeGap[];
  // True while a rescan triggered by newly ingested documentation is still
  // running. The gaps alongside it are the previous result, so the panel can
  // say so instead of showing stale numbers with no explanation.
  refreshing?: boolean;
  // When the returned gaps were computed. Null before the first scan.
  refreshedAt?: string | null;
}
