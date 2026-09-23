/**
 * Defines the specific entity type of an artifact.
 * Used by the UI to determine icon representations and filtering logic.
 */
export type ArtifactType = "COMMIT" | "FILE" | "ISSUE" | "PULL_REQUEST" | "PAGE" | "ORG_METADATA";

/**
 * Origin source of the artifact data.
 * Used to route API calls (e.g., Github vs internal Uploads).
 */
export type SourceSystem = "GITHUB" | "JIRA" | "UPLOAD" | "CONFLUENCE";

/**
 * Core business entity representing any indexed piece of knowledge.
 * Unifies diverse sources (like Github PRs and direct file uploads) into a single
 * searchable and summariable format.
 */
export interface Artifact {
  id: string;
  title: string | null;
  artifactType: ArtifactType;
  sourceSystem: SourceSystem;
  sourceId: string;
  sourceUrl: string | null;
  mime: string | null;
  language: string | null;
  /** When the artifact was first imported. Never moves on later updates. */
  ingestedAt: string;
  /**
   * When ingestion last saw the artifact's content change, or null while it still
   * matches what was first imported.
   */
  lastChangedAt: string | null;
  contentHash: string | null;
  ingestionRunId: string | null;
  /**
   * Backend-supplied metadata as a JSON string. Optional here rather than
   * required: the backend defaults it to `"{}"`, but older artifacts predating
   * the field — and every fixture that omits it — must stay assignable.
   * For `ORG_METADATA` artifacts it carries the GitHub org profile, teams and
   * members — see
   * [`parseOrgMetadata`](./orgMetadata); for GitHub repo artifacts (`COMMIT`,
   * `FILE`, `ISSUE`, `PULL_REQUEST`) it carries `repositoryId` and
   * `repositoryFullName` — see [`parseGithubMetadata`](./githubMetadata). The
   * artifact *content* endpoint
   * (`GET /artifacts/{id}/content`) is a 302 redirect to the org's GitHub page for
   * this type and holds no stored bytes, so org artifacts must be rendered purely
   * from this field (see `ArtifactViewerDrawer`).
   */
  metadata?: string;
}

/**
 * The raw content of an artifact retrieved from the backend,
 * along with its MIME type for correct rendering (Markdown vs plain text).
 */
export interface ArtifactContent {
  content: string;
  mimeType: string;
  isObjectUrl?: boolean;
}

/**
 * Citation metadata for an AI-generated artifact summary, sourced from the AI service
 * and passed through the backend unchanged.
 */
export interface ArtifactSummaryCitation {
  artifactId: string;
  filename: string;
  sourceUrl: string | null;
}

/**
 * Callbacks invoked by {@link streamArtifactSummary} as the backend streams
 * summary events over Server-Sent Events.
 */
export interface SummaryStreamHandlers {
  /** Called for each incremental token chunk of the generated summary. */
  onToken: (chunk: string) => void;
  /** Called when the AI transitions to a new generation stage (e.g. Analyzing...). */
  onStage?: (name: string, detail: string) => void;
  /** Called when the backend emits a citation (source reference). */
  onCitation: (citation: ArtifactSummaryCitation) => void;
  /** Called once the stream has completed successfully. */
  onDone: () => void;
  /** Called when an in-stream error event is received (non-HTTP failure). */
  onError?: (error: string) => void;
}

/**
 * Filter classification for direct uploaded artifact formats.
 */
export type UploadFormat = "PDF" | "MARKDOWN" | "IMAGE" | "OTHER";

/**
 * Pagination metadata returned by Spring Boot Page response.
 */
export interface PageMetadata {
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  isFirst: boolean;
  isLast: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated list response for artifacts from GET /api/v1/projects/{projectId}/artifacts.
 */
export interface ArtifactPage {
  items: Artifact[];
  metadata: PageMetadata;
}

/**
 * Single facet entry value and matched artifact count.
 */
export interface FacetCount {
  value: string;
  count: number;
}

/**
 * Aggregated facet breakdown for knowledge base artifacts in a project.
 */
export interface ArtifactFacets {
  types: FacetCount[];
  sources: FacetCount[];
  formats: FacetCount[];
  repositories: FacetCount[];
}

/**
 * Query parameters for filtering and paginating knowledge base artifacts.
 */
export interface KnowledgeListParams {
  page?: number;
  size?: number;
  search?: string;
  types?: ArtifactType[];
  sources?: SourceSystem[];
  repositories?: string[];
  format?: UploadFormat;
}
