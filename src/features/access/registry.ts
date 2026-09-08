import { useMemo } from "react";
import { GitBranch, Ticket } from "lucide-react";
import { useGithubTokens } from "../settings/hooks/useGithubTokens";
import { useAtlassianCredentials } from "../settings/hooks/useAtlassianCredentials";
import { TokenAddForm } from "../settings/components/TokenAddForm";
import {
  GithubTokenRow,
  AtlassianAccessAddForm,
  AtlassianAccessRow,
} from "./components/connectorAdapters";
import type { AtlassianCredentialDto } from "../../services/sources/atlassianService";
import type { AccessConnector } from "./types";

/**
 * Erases a connector's payload type so the registry can be one homogeneous
 * list. Safe because a payload only ever travels from a connector's own
 * `useEntries` into that same connector's `Row` — it is never handed to another
 * connector, and the view itself treats it as opaque.
 */
function defineAccessConnector<TPayload>(connector: AccessConnector<TPayload>): AccessConnector {
  return connector as AccessConnector;
}

export const githubConnector = defineAccessConnector<string>({
  id: "github",
  label: "GitHub",
  icon: GitBranch,
  noun: { one: "token", many: "tokens" },
  addLabel: "Add token",
  emptyTitle: "No tokens yet",
  emptyDescription: "Add a GitHub Personal Access Token to enable repository ingestion.",
  useEntries: () => {
    const { tokenNames, tokensLoaded, tokensError, isRefreshing, loadTokenNames } =
      useGithubTokens();

    // PATs are global and identified by name alone, so the name is both the
    // key and the whole payload.
    const entries = useMemo(
      () => tokenNames.map((name) => ({ key: name, payload: name })),
      [tokenNames],
    );

    return {
      entries,
      loaded: tokensLoaded,
      error: tokensError,
      isRefreshing,
      reload: loadTokenNames,
    };
  },
  AddForm: TokenAddForm,
  Row: GithubTokenRow,
});

export const atlassianConnector = defineAccessConnector<AtlassianCredentialDto>({
  id: "atlassian",
  label: "Atlassian",
  icon: Ticket,
  noun: { one: "credential", many: "credentials" },
  addLabel: "Add credential",
  emptyTitle: "No credentials yet",
  emptyDescription: "Add an Atlassian API token to connect Jira instances and Confluence spaces.",
  useEntries: () => {
    const { credentials, loaded, error, isRefreshing, reload } = useAtlassianCredentials();

    // Credentials are keyed by `(userEmail, tokenName)` server-side; the same
    // name may exist for two Atlassian accounts, so the key needs both.
    const entries = useMemo(
      () =>
        credentials.map((credential) => ({
          key: `${credential.userEmail}:${credential.displayName}`,
          payload: credential,
        })),
      [credentials],
    );

    return { entries, loaded, error, isRefreshing, reload };
  },
  AddForm: AtlassianAccessAddForm,
  Row: AtlassianAccessRow,
});

/**
 * Every source whose access is managed in the unified view, in display order.
 *
 * **Adding a connector is an entry in this list** plus its hook, row and add
 * form — no new tab, no page change, no layout change. Keep the list short
 * enough that the source filter stays useful.
 */
export const ACCESS_CONNECTORS: AccessConnector[] = [githubConnector, atlassianConnector];
