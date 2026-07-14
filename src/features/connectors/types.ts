import type { LucideIcon } from "lucide-react";
import type {
    ConnectorDto,
    ConnectorSource,
} from "../../services/connectorService.ts";

export type { ConnectorDto, ConnectorSource } from "../../services/connectorService.ts";

export type LoadingState = "idle" | "loading" | "success" | "error";

/**
 * Static presentation metadata for a connector, keyed by its backend id
 * (e.g. "github"). Connectors without an entry here (such as a future Jira
 * connector, not yet implemented server-side) still render using a generic
 * fallback built from the backend-provided `name`.
 */
export type ConnectorMeta = {
    label: string;
    description: string;
    icon: LucideIcon;
};

/**
 * A connector paired with its resolved display metadata, used by
 * `ConnectorList`.
 */
export type ConnectorListItem = ConnectorDto & {
    meta: ConnectorMeta;
};

/**
 * Draft (unsaved) allow/deny changes for a connector's sources, keyed by the
 * source list snapshot they were computed against (`sourceKey`), so stale
 * drafts are discarded automatically when fresh data loads - mirrors the
 * pattern used by `ProjectAccessPanel`.
 */
export type DraftSourceChanges = {
    sourceKey: string;
    changedSourceIds: Set<string>;
};

export type ConnectorSourceRow = ConnectorSource;
