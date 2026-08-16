import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../../../data-ingestion/components/GithubRepositoryDiscovery";
import { JiraConnectStep } from "../../../../data-ingestion/components/JiraConnectStep";
import { SourceTypeStep } from "../../../../data-ingestion/components/SourceTypeStep";
import type { SourceSystem } from "../../../../data-ingestion/types";
import type { JiraCredentialsDto } from "../../../../../services/sources/jiraService";

/** The two screens of the add-source sub-flow: pick a type, then fill it in. */
export type AddSourceStep = "type" | "detail";

/** GitHub detail is fully controlled so the footer's "Add to list" can read it. */
type GithubDetailProps = {
  tokenNames: string[];
  tokenName: string;
  onTokenNameChange: (name: string) => void;
  /** Must be stable (a state setter) — the picker only re-reports on change. */
  onSelectionChange: (selection: DiscoverySelection[]) => void;
};

/** Jira detail — a staged form; nothing connects until provisioning. */
type JiraDetailProps = {
  displayName: string;
  url: string;
  credentialName: string;
  credentials: JiraCredentialsDto[];
  credentialsLoaded: boolean;
  credentialsLoading: boolean;
  credentialsError: string | null;
  onDisplayNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onCredentialNameChange: (value: string) => void;
  /** Enter in a field stages the source (guarded), matching "Add to list". */
  onSubmit: () => void;
};

type AddSourceFlowProps = {
  step: AddSourceStep;
  selectedType: SourceSystem;
  /**
   * The source types that can actually be staged here. Jira and Upload still
   * render in the grid (with a "Soon" badge) when not listed, so the shape of
   * the flow does not change as later phases enable them.
   */
  availableTypes: SourceSystem[];
  onSelectType: (type: SourceSystem) => void;
  isBusy?: boolean;
  github: GithubDetailProps;
  jira: JiraDetailProps;
};

/**
 * The "Add source" sub-flow shown inside the wizard's Sources step: a type grid
 * that advances into the type-specific detail screen. It stages a source rather
 * than connecting one — the detail screens capture what is needed and the wizard
 * turns it into a draft when the user commits from the footer.
 *
 * The sub-flow is presentational: the wizard owns which screen is shown and the
 * captured detail state, so its single Modal footer can drive Back / Add to list
 * without this component reaching into it.
 */
export function AddSourceFlow({
  step,
  selectedType,
  availableTypes,
  onSelectType,
  isBusy = false,
  github,
  jira,
}: AddSourceFlowProps) {
  if (step === "type") {
    return (
      <SourceTypeStep
        selectedType={selectedType}
        onSelectType={onSelectType}
        heading="Add a source"
        description="Pick a type — you'll fill in the details on the next screen."
        availableTypes={availableTypes}
      />
    );
  }

  if (selectedType === "JIRA") {
    return (
      <JiraConnectStep
        displayName={jira.displayName}
        url={jira.url}
        credentialName={jira.credentialName}
        credentials={jira.credentials}
        credentialsLoaded={jira.credentialsLoaded}
        credentialsLoading={jira.credentialsLoading}
        credentialsError={jira.credentialsError}
        isBusy={isBusy}
        canIngest
        errorMessage={null}
        onDisplayNameChange={jira.onDisplayNameChange}
        onUrlChange={jira.onUrlChange}
        onCredentialNameChange={jira.onCredentialNameChange}
        onSubmit={jira.onSubmit}
      />
    );
  }

  // GitHub detail. Upload arrives in a later phase and slots in here.
  return (
    <GithubRepositoryDiscovery
      tokenNames={github.tokenNames}
      projectId={null}
      tokenName={github.tokenName}
      onTokenNameChange={github.onTokenNameChange}
      onSelectionChange={github.onSelectionChange}
      isConnecting={isBusy}
    />
  );
}
