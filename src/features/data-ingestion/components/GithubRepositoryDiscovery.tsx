import { ApiError } from "../../../services/apiClient.ts";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { discoverRepositories } from "../../../services/sources/githubService.ts";
import {
  parseGithubOwnerInput,
  parseGithubRepositoryReference,
} from "../../../services/sources/githubRepositoryInput.ts";
import {
  RepositoryDiscovery,
  type DiscoverySelection,
  type RepositoryDiscoveryAdapter,
} from "./RepositoryDiscovery.tsx";

// Re-exported so the wizard, the add-source modal and the draft helpers keep
// importing the selection types from here.
export type { DiscoverySelection, RepositoryLinkState } from "./RepositoryDiscovery.tsx";

type GithubRepositoryDiscoveryProps = {
  tokenNames: string[];
  /**
   * Project the repositories would be connected to, or `null` when there is no
   * project yet (e.g. the create-project wizard stages the selection first). With
   * no project the "already in this project" classification is skipped, but the
   * global "ingested elsewhere" check still runs.
   */
  projectId: string | null;
  projectName?: string;
  /** Controlled token selection (the parent needs it at connect time). */
  tokenName: string;
  onTokenNameChange: (name: string) => void;
  /** Reports the resolved selection whenever it changes. Must be stable. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
  /** True while the parent runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
  /** Connect error from the parent, shown below any discovery error. */
  connectError?: string | null;
  /**
   * Hides the built-in "no stored token" banner. Set when the parent shows its
   * own missing-token hint (e.g. the wizard's compact notice next to its inline
   * "Add token" button) so the message is not duplicated.
   */
  suppressMissingTokenNotice?: boolean;
};

/**
 * How {@link RepositoryDiscovery} talks to GitHub: an owner is an organization or
 * a user, resolved on the service side ("auto" tries the org endpoint first and
 * falls back to the user endpoint), so the user never has to know or pick which
 * kind they typed.
 */
const GITHUB_DISCOVERY_ADAPTER: RepositoryDiscoveryAdapter = {
  sourceSystem: "GITHUB",
  providerName: "GitHub",
  discover: async (owner, tokenName, page, pageSize) => {
    const result = await discoverRepositories(owner, tokenName, "auto", page, pageSize);

    return { repositories: result.repositories, hasMore: result.hasMore };
  },
  parseInput: (value) => {
    const reference = parseGithubRepositoryReference(value);
    if (reference) return { owner: reference.owner, name: reference.name };

    const owner = parseGithubOwnerInput(value);
    return owner ? { owner, name: null } : null;
  },
  ownerLabel: "Organization, user, or URL",
  ownerPlaceholder: "octocat, github.com/octocat, or a repo URL",
  invalidInputMessage:
    "Enter a GitHub organization, user, or repository URL (e.g. octocat or github.com/octocat/hello-world).",
  credentialRequiredMessage: "Choose a stored GitHub access token.",
  missingCredentialNotice:
    "Add a GitHub personal access token in Settings first, then come back to discover repositories.",
  emptyResultHint: (
    <>
      The token may only see public repositories. Private repositories require a token with broader
      scope (e.g. <code>read:org</code> / repo access).
    </>
  ),
  describeError: (error, owner) => {
    if (error instanceof ApiError && error.status === 404) {
      return `No GitHub organization or user "${owner}" was found for the selected token.`;
    }

    if (error instanceof ApiError && error.status === 429) {
      return "GitHub rate limit reached. Please wait a moment and try again.";
    }

    return null;
  },
};

/**
 * GitHub org/user repository discovery: {@link RepositoryDiscovery} with the
 * GitHub adapter and a stored-token picker. Keeps the props the create-project
 * wizard and the add-source modal already use.
 */
export function GithubRepositoryDiscovery({
  tokenNames,
  projectId,
  tokenName,
  onTokenNameChange,
  onSelectionChange,
  isConnecting = false,
  connectError,
  suppressMissingTokenNotice = false,
}: GithubRepositoryDiscoveryProps) {
  const hasTokens = tokenNames.length > 0;

  return (
    <RepositoryDiscovery
      adapter={GITHUB_DISCOVERY_ADAPTER}
      hasCredentials={hasTokens}
      credentialName={tokenName}
      renderCredentialPicker={({ disabled }) => (
        <div>
          <span className="text-sm font-medium text-app-text">Access token</span>
          <DropdownSelect
            label="Access token"
            value={tokenName}
            options={
              hasTokens
                ? tokenNames.map((name) => ({ value: name, label: name }))
                : [{ value: "", label: "No saved tokens" }]
            }
            onChange={onTokenNameChange}
            disabled={disabled}
            className="mt-2 sm:w-52"
          />
        </div>
      )}
      projectId={projectId}
      onSelectionChange={onSelectionChange}
      isConnecting={isConnecting}
      connectError={connectError}
      suppressMissingCredentialNotice={suppressMissingTokenNotice}
    />
  );
}
