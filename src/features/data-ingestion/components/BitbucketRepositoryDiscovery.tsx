import { AlertTriangle } from "lucide-react";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { ApiError } from "../../../services/apiClient.ts";
import type { AtlassianCredentialDto } from "../../../services/sources/atlassianService.ts";
import { discoverBitbucketRepositories } from "../../../services/sources/bitbucketService.ts";
import {
  parseBitbucketRepositoryReference,
  parseBitbucketWorkspaceInput,
} from "../../../services/sources/bitbucketRepositoryInput.ts";
import {
  RepositoryDiscovery,
  type DiscoverySelection,
  type RepositoryDiscoveryAdapter,
} from "./RepositoryDiscovery.tsx";

type BitbucketRepositoryDiscoveryProps = {
  /** The caller's stored Atlassian credentials, shared with Jira and Confluence. */
  credentials: AtlassianCredentialDto[];
  /** Whether the credential list has finished loading, so "none stored" is not shown early. */
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  credentialsError: string | null;
  /** Controlled credential selection (the parent needs it at connect time). */
  credentialName: string;
  onCredentialNameChange: (name: string) => void;
  /**
   * Project the repositories would be connected to, or `null` when there is no
   * project yet (the create-project wizard). See {@link RepositoryDiscovery}.
   */
  projectId: string | null;
  /** Reports the resolved selection whenever it changes. Must be stable. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
  /** True while the parent runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
  /** Connect error from the parent, shown below any discovery error. */
  connectError?: string | null;
  /**
   * Hides the built-in "no stored credential" banner. Set when the parent shows
   * its own hint (e.g. the wizard's chip next to its inline "Add credential"
   * button) so the message is not duplicated.
   */
  suppressMissingCredentialNotice?: boolean;
};

/**
 * How {@link RepositoryDiscovery} talks to Bitbucket Cloud. Discovery is always
 * scoped to one workspace (Bitbucket has no cross-workspace listing), so the
 * owner field takes a workspace id, `bitbucket.org/<workspace>` or a repository
 * URL, which narrows the list to that repository. The selection's `name` is the
 * repository slug; the display name only labels the row.
 */
const BITBUCKET_DISCOVERY_ADAPTER: RepositoryDiscoveryAdapter = {
  sourceSystem: "BITBUCKET",
  providerName: "Bitbucket",
  discover: async (workspace, credentialName, page, pageSize) => {
    const result = await discoverBitbucketRepositories(workspace, credentialName, page, pageSize);

    return {
      repositories: result.repositories.map((repository) => ({
        name: repository.slug,
        // The slug only adds information when it is more than the lowercased
        // display name ("Widget Shop (widget-shop)", but just "Widgets").
        label:
          repository.name === repository.slug
            ? undefined
            : repository.name.toLowerCase() === repository.slug.toLowerCase()
              ? repository.name
              : `${repository.name} (${repository.slug})`,
        isPrivate: repository.isPrivate,
        url: repository.url,
        alreadyConnected: repository.alreadyConnected,
        isEnabled: repository.isEnabled,
      })),
      hasMore: result.hasMore,
    };
  },
  parseInput: (value) => {
    const reference = parseBitbucketRepositoryReference(value);
    if (reference) return { owner: reference.workspace, name: reference.slug };

    const workspace = parseBitbucketWorkspaceInput(value);
    return workspace ? { owner: workspace, name: null } : null;
  },
  ownerLabel: "Workspace or bitbucket.org URL",
  ownerPlaceholder: "acme, bitbucket.org/acme, or a repo URL",
  invalidInputMessage:
    "Enter a Bitbucket workspace or repository URL (e.g. acme or bitbucket.org/acme/widgets).",
  credentialRequiredMessage: "Choose a stored Atlassian credential.",
  missingCredentialNotice:
    "No Atlassian credentials are stored for your account. Add one under Settings, Access Tokens, Atlassian first, then come back to discover repositories.",
  emptyResultHint:
    "The credential may not be allowed to read this workspace's repositories. Its token needs Bitbucket scopes for repositories, pull requests and the workspace.",
  describeError: (error, workspace) => {
    if (error instanceof ApiError && error.status === 404) {
      return `The selected credential was not found, or no workspace "${workspace}" is visible to it.`;
    }

    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return `The selected credential can't read workspace "${workspace}". Check that its token has Bitbucket scopes.`;
    }

    if (error instanceof ApiError && error.status === 429) {
      return "Bitbucket rate limit reached. Please wait a moment and try again.";
    }

    return null;
  },
};

/**
 * Bitbucket workspace repository discovery: {@link RepositoryDiscovery} with the
 * Bitbucket adapter and an Atlassian credential picker. Used by the add-source
 * modal and the create-project wizard.
 */
export function BitbucketRepositoryDiscovery({
  credentials,
  credentialsLoaded,
  credentialsLoading,
  credentialsError,
  credentialName,
  onCredentialNameChange,
  projectId,
  onSelectionChange,
  isConnecting = false,
  connectError,
  suppressMissingCredentialNotice = false,
}: BitbucketRepositoryDiscoveryProps) {
  const hasCredentials = credentials.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-app-text-muted">
        The credential&rsquo;s token needs Bitbucket scopes: read access to repositories, pull
        requests and the workspace.
      </p>

      {credentialsError && (
        <div className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{credentialsError}</span>
        </div>
      )}

      <RepositoryDiscovery
        adapter={BITBUCKET_DISCOVERY_ADAPTER}
        hasCredentials={hasCredentials}
        credentialName={credentialName}
        renderCredentialPicker={({ disabled }) => (
          <div>
            <span className="text-sm font-medium text-app-text">Credential</span>
            <DropdownSelect
              label="Credential"
              value={credentialName}
              options={
                hasCredentials
                  ? credentials.map((credential) => ({
                      value: credential.displayName,
                      label: `${credential.displayName} - ${credential.userEmail}`,
                    }))
                  : [
                      {
                        value: "",
                        label: credentialsLoading ? "Loading credentials..." : "No credentials",
                      },
                    ]
              }
              onChange={onCredentialNameChange}
              disabled={disabled}
              className="mt-2 sm:w-64"
            />
          </div>
        )}
        projectId={projectId}
        onSelectionChange={onSelectionChange}
        isConnecting={isConnecting}
        connectError={connectError}
        // The banner only means something once the list has loaded.
        suppressMissingCredentialNotice={
          suppressMissingCredentialNotice || !credentialsLoaded || credentialsLoading
        }
      />
    </div>
  );
}
