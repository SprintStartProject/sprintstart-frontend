import type { ComponentType, ReactNode } from "react";
import type { IconComponent } from "../../../components/icons/types.ts";
import type {
  SyncScheduleConfig,
  SyncScheduleRequest,
} from "../../../services/sources/syncSchedule.ts";
import type {
  BackendProjectSourceStatus,
  DataSource,
  SourceDetails,
  SourceInstanceIngestionStatus,
} from "../types.ts";
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

/**
 * Everything the data ingestion UI needs to know about one connector. Adding a
 * connector means adding a definition and registering it in `registry.ts`; the
 * generic mapper, the labels and icons, the details panel, the page actions and
 * the chat source filter all read from here instead of branching on the source
 * system.
 *
 * @typeParam C - The connector's own connection record the card is merged with
 *   (a project source, a Jira instance, a Confluence connection).
 *
 * The functions are declared as methods on purpose: that keeps a definition for
 * one connection record assignable to the registry's connection-agnostic view.
 */
export type ConnectorDefinition<C = unknown> = {
  meta: ConnectorMeta;
  chat: {
    /** Whether the chat's source filter can scope a question to this connector. */
    filterable: boolean;
  };
  actions: SourceActions;
  /** The connector's own card in the details panel (identity rows); null when it has none. */
  DetailsSection: ComponentType<DetailsSectionProps> | null;
  /** How the run history is scoped to one source; absent when runs cannot be told apart. */
  runFilter?: RunFilter;
  /** The card's selection key and display name. */
  identity(
    status: SourceInstanceIngestionStatus | null,
    connection: C | null,
  ): { sourceId: string; name: string };
  /** The backend status to show when no status row exists for the source. */
  fallbackBackendStatus(connection: C | null): BackendProjectSourceStatus;
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
