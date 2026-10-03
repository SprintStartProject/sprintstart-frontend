import type { IconComponent } from "../../../components/icons/types.ts";
import type {
  BackendProjectSourceStatus,
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

/**
 * Everything the data ingestion UI needs to know about one connector. Adding a
 * connector means adding a definition and registering it in `registry.ts`; the
 * generic mapper, the labels and icons and the chat source filter all read from
 * here instead of branching on the source system.
 *
 * @typeParam C - The connector's own connection record the card is merged with
 *   (a project source, a Jira instance, a Confluence connection).
 *
 * The functions are declared as methods on purpose: that keeps a definition for
 * one connection record assignable to the registry's connection-agnostic view.
 */
export type ConnectorDefinition<C = unknown> = {
  meta: ConnectorMeta;
  /** Whether the connector's sources poll their upstream on a configurable schedule. */
  supportsSchedule: boolean;
  chat: {
    /** Whether the chat's source filter can scope a question to this connector. */
    filterable: boolean;
  };
  /** The card's selection key and display name. */
  identity(
    status: SourceInstanceIngestionStatus | null,
    connection: C | null,
  ): { sourceId: string; name: string };
  /** The backend status to show when no status row exists for the source. */
  fallbackBackendStatus(connection: C | null): BackendProjectSourceStatus;
  /** The identity and sync times only this connector's sources have. */
  toDetails(status: SourceInstanceIngestionStatus | null, connection: C | null): SourceDetails;
  /**
   * The references a run of this source carries as its `sourceId`, so a run can be
   * labelled with the source's display name.
   */
  runReferences(details: SourceDetails): string[];
};
