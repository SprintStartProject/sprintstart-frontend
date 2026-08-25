import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * One stored credential as the unified view sees it: an opaque `payload` under
 * a stable key. The view never inspects the payload — it only counts entries
 * and keys them; the connector's own `Row` reads it back and renders it. That
 * is what lets sources with different credential models (GitHub's global PATs,
 * Jira's per-user `(email, name)` pairs) share one list.
 */
export type AccessEntry<TPayload = unknown> = {
  /** Unique within its connector; used as the React key. */
  key: string;
  payload: TPayload;
};

/** What a connector's `useEntries` hook has to return. */
export type AccessConnectorState<TPayload = unknown> = {
  entries: AccessEntry<TPayload>[];
  /** False until the first load settled — drives the initial spinner. */
  loaded: boolean;
  error: string | null;
  isRefreshing: boolean;
  reload: () => Promise<void>;
};

export type AccessAddFormProps = {
  onClose: () => void;
  /** Refetches the connector's entries; rejects when the refetch itself fails. */
  onSaved: () => Promise<void>;
};

export type AccessRowProps<TPayload = unknown> = {
  entry: AccessEntry<TPayload>;
  onSaved: () => Promise<void>;
};

/**
 * Everything the unified view needs to manage one source's access.
 *
 * The registry in `registry.tsx` is the single place a source is declared: the
 * source filter, the group order and the layout are all derived from that list,
 * which is what keeps a new connector from needing its own tab — or any change
 * to the pages hosting the view.
 */
export type AccessConnector<TPayload = unknown> = {
  /** Stable id; doubles as the value of the source filter. */
  id: string;
  label: string;
  icon: LucideIcon;
  /** What one stored entry is called here — "token" for GitHub, "credential" for Jira. */
  noun: { one: string; many: string };
  addLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  /**
   * Loads this connector's entries. Called exactly once per rendered group, so
   * it may own state and fire requests.
   */
  useEntries: () => AccessConnectorState<TPayload>;
  AddForm: ComponentType<AccessAddFormProps>;
  Row: ComponentType<AccessRowProps<TPayload>>;
};
