import type { ComponentType, ReactNode } from "react";
import type { IconComponent } from "../../../components/icons/types.ts";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../services/sources/syncSchedule.ts";
import type {
  BackendProjectSourceStatus,
  DataSource,
  IngestionRun,
  SourceDetails,
  SourceInstanceIngestionStatus,
} from "../types.ts";
import type { Artifact } from "../../knowledge-base/types.ts";
import type { DraftConnectOutcome, DraftSource } from "./draft.ts";
import type { SourceSystem } from "./sourceSystems.ts";

/** How a connector presents itself wherever its sources are named. */
export type ConnectorMeta = {
  system: SourceSystem;
  /** The id the backend's connector endpoints use (lowercase, e.g. "github"). */
  connectorId: string;
  /** Short label, e.g. "GitHub". */
  label: string;
  /** Name of one source of this connector as a card title, e.g. "GitHub Repository". */
  name: string;
  /** What a source of this connector is called, e.g. "repository" and "repositories". */
  noun: { singular: string; plural: string };
  icon: IconComponent;
  description: string;
  /**
   * Wording of the Manage-connectors modal. A connector without it is listed under
   * the name the backend reports for it.
   */
  connector?: { label: string; description: string };
};

/** What an action may need to know beyond the source it acts on. */
export type ActionContext = {
  /** The selected project; null before one is confirmed. */
  projectId: string | null;
};

/** The outcome of a synchronous sync, normalised so every connector reports it the same way. */
export type ManualSyncOutcome = {
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  title: string;
  description: string;
};

/**
 * What a source of one connector can be told to do. An action a connector does
 * not have is simply absent, and the details panel does not offer it.
 * `isAvailable` says whether this particular source carries what the action
 * needs (an identity, an id), so a card that could not be resolved offers it
 * disabled or not at all.
 *
 * The functions are declared as methods, like on {@link ConnectorDefinition}, so
 * a connector-specific definition stays assignable to the registry's view.
 */
export type SourceActions = {
  /** Starts a re-ingestion that runs in the background; progress arrives through the status. */
  update?: {
    isAvailable(source: DataSource): boolean;
    /** Shown on the disabled button when `isAvailable` is false. */
    unavailableReason: string;
    run(source: DataSource, context: ActionContext): Promise<void>;
  };
  /** Runs a re-ingestion to completion and reports how it went. Instead of `update`. */
  manualSync?: {
    isAvailable(source: DataSource): boolean;
    unavailableReason: string;
    run(source: DataSource, context: ActionContext): Promise<ManualSyncOutcome>;
  };
  /** Removes the source's link to the project. */
  unlink?: {
    isAvailable(source: DataSource): boolean;
    /** What removal costs, shown in the panel and its confirmation. */
    removalHint: string;
    run(source: DataSource, context: ActionContext): Promise<void>;
  };
  /** Includes the source in, or excludes it from, ingestion. */
  setEnabled?: {
    isAvailable(source: DataSource): boolean;
    run(source: DataSource, enabled: boolean, context: ActionContext): Promise<void>;
  };
  /** The source's sync schedule. The project-wide settings apply it to every source. */
  schedule?: {
    isAvailable(source: DataSource): boolean;
    load(source: DataSource, context: ActionContext): Promise<SyncScheduleConfig>;
    save(source: DataSource, request: SyncScheduleRequest, context: ActionContext): Promise<void>;
  };
};

/**
 * How the page loads a connector's own records of a project's sources. A card is
 * built from the status row, and merged with this record for what the row lacks
 * (a credential, a connection id).
 */
export type ConnectionSupport<C> = {
  /**
   * Names what is loaded. Connectors that read the same endpoint name the same scope
   * and so share one request and one cache entry.
   */
  scope: string;
  load(projectId: string): Promise<C[]>;
  /**
   * What to tell the user when the load fails. Without it a failure is silent and the
   * cards are built without these records, for endpoints a user may not be allowed to
   * read (an HR user without the PM role Jira's instance list requires).
   */
  failureMessage?: string;
  /** Whether the records change while ingestion runs, so they are reloaded with the status rows. */
  live?: boolean;
};

/** What a connector's section of the details panel receives. */
export type DetailsSectionProps = {
  source: DataSource;
  /** The row that shows, and for managers switches, whether the source is included in ingestion. */
  enabledRow: ReactNode;
};

/** How a source is picked in the run history's filter. */
export type RunFilter = {
  /** The query parameter the run endpoint scopes by. */
  param: "repositoryId" | "sourceRef";
  /** The value for that parameter; null when the source cannot be filtered on. */
  valueOf(source: DataSource): string | null;
};

/** What the host of an add-source form knows that the form cannot find out itself. */
export type DraftFormContext = {
  /**
   * The project the sources are added to, so discovery can flag what is already
   * connected to it. Null in the create-project wizard, where no project exists yet.
   */
  projectId: string | null;
  projectName?: string;
  /** GitHub token names the host has already loaded, used until the form's own list arrives. */
  tokenNames: string[];
};

/** What a connector's add-source form receives. */
export type DraftFormProps<D> = {
  context: DraftFormContext;
  isBusy: boolean;
  /**
   * Reports the sources the form currently describes: several at once for a
   * multi-select, one for a plain form, none while it is incomplete. Called on
   * mount and whenever the answer changes, so the host can enable "Add to list".
   */
  onDraftsChange: (drafts: D[]) => void;
  /** Enter in a field stages the source (guarded by the host), matching "Add to list". */
  onSubmit: () => void;
  /** Told when the desktop credential companion opens or closes, so the modal can slide left. */
  onCompanionOpenChange?: (open: boolean) => void;
};

/**
 * How the knowledge base presents the artifacts a connector ingested. The
 * functions are declared as methods, like on {@link ConnectorDefinition}.
 */
export type KnowledgeBaseSupport = {
  /** The source facet's name for the connector, e.g. "Uploads". */
  label: string;
  /** Position in the source facet, ascending. */
  facetOrder: number;
  icon: IconComponent;
  /**
   * The text of the link to an artifact at its origin ("Open in GitHub"). Null when an
   * artifact has no origin to open, as with uploads.
   */
  linkLabel: string | null;
  /** Whether the artifacts' content is Markdown whatever its mime type says. */
  markdown?: boolean;
  /** Whether a user can delete the artifacts here, because nothing upstream owns them. */
  deletable?: boolean;
  /**
   * The narrowing beyond the source system that the knowledge base can express for one
   * source, used to link from the source to its artifacts. Left out when the knowledge
   * base has no filter finer than the system, as for Jira, Confluence and uploads.
   */
  scopeOf?(details: SourceDetails): { repositories?: string[] };
  /**
   * A view for artifacts that have no stored content to fetch and render from their
   * `metadata` instead. The viewer shows it in place of the content.
   */
  metadataView?: {
    appliesTo(artifact: Artifact): boolean;
    View: (props: { artifact: Artifact }) => ReactNode;
  };
};

/**
 * How a source of a connector is staged before it is connected: the form that
 * captures it, how the staged row reads, whether two rows are the same source and
 * what connecting one does. The functions are declared as methods, like on
 * {@link ConnectorDefinition}, so a definition for one draft type stays assignable
 * to the registry's view.
 */
export type DraftSupport<D> = {
  /**
   * The form that captures what is needed to stage a source. It holds its own state.
   * A plain function type rather than `ComponentType`, so a form for one draft type
   * stays assignable to the registry's view of all of them.
   */
  DraftForm: (props: DraftFormProps<D>) => ReactNode;
  /** One-line brief under the form's header. */
  formHint: string;
  /** Primary line of a staged row. */
  title(draft: D): string;
  /** Secondary line of a staged row that has not failed. */
  detail(draft: D): string;
  /** The status line of a row that is not connected yet, when it differs from the default. */
  pendingNote?(draft: D): string | null;
  /**
   * The knowledge-gap component an owner staged on the row is assigned to. A
   * connector without it has no owner picker on its rows.
   */
  ownerComponent?(draft: D): string | null;
  /** Whether two staged rows point at the same underlying source, used to dedupe on add. */
  isSame(left: D, right: D): boolean;
  /** Connects the staged source to the project and reports what that did beyond succeeding. */
  connect(draft: D, projectId: string): Promise<DraftConnectOutcome>;
};

/**
 * Everything the data ingestion UI needs to know about one connector. Adding a
 * connector means adding a definition and registering it in `registry.ts`; the
 * generic mapper, the labels and icons, the details panel, the page actions and
 * the chat source filter all read from here instead of branching on the source
 * system.
 *
 * @typeParam C - The connector's own connection record the card is merged with
 *   (a project source, a Jira instance, a Confluence connection).
 * @typeParam D - The connector's staged source.
 *
 * The functions are declared as methods on purpose: that keeps a definition for
 * one connection record assignable to the registry's connection-agnostic view.
 */
export type ConnectorDefinition<C = unknown, D extends DraftSource = DraftSource> = {
  meta: ConnectorMeta;
  chat: {
    /** Whether the chat's source filter can scope a question to this connector. */
    filterable: boolean;
    /**
     * Whether a cited source with this URL and name (both lowercased) comes from this
     * connector. A citation names only the artifact's URL and title, so this is how the
     * chat tells which connector's artifact it is opening.
     */
    matchesCitationUrl?(url: string, name: string): boolean;
    /** Claims every citation no connector matches, e.g. a self-hosted GitHub. One connector sets it. */
    isDefaultCitationSource?: boolean;
  };
  knowledgeBase: KnowledgeBaseSupport;
  connections: ConnectionSupport<C>;
  actions: SourceActions;
  /** The connector's own card in the details panel (identity rows); null when it has none. */
  DetailsSection: ComponentType<DetailsSectionProps> | null;
  /** How the run history is scoped to one source; absent when runs cannot be told apart. */
  runFilter?: RunFilter;
  /** How a source is staged and connected from the add-source flow. */
  draft: DraftSupport<D>;
  /** The card's selection key and display name. */
  identity(
    status: SourceInstanceIngestionStatus | null,
    connection: C | null,
  ): { sourceId: string; name: string };
  /** The backend status to show when no status row exists for the source. */
  fallbackBackendStatus(connection: C | null): BackendProjectSourceStatus;
  /**
   * How a source without a status row reads its artifact total and sync time off its
   * newest run. Without it the card shows the run's ingested count, an unknown total
   * and the run's start.
   */
  runFallback?: {
    artifactCount(run: IngestionRun): number;
    syncedAt(run: IngestionRun): string | null;
  };
  /** The identity and sync times only this connector's sources have. */
  toDetails(status: SourceInstanceIngestionStatus | null, connection: C | null): SourceDetails;
  /** The last-sync time per kind of resource the connector ingests (commits, issues, …). */
  resourceSyncTimes(details: SourceDetails): { label: string; value: string | null }[];
  /**
   * The references a run of this source carries as its `sourceId`, so a run can be
   * labelled with the source's display name.
   */
  runReferences(details: SourceDetails): string[];
};
