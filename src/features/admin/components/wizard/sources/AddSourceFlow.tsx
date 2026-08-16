import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../../../data-ingestion/components/GithubRepositoryDiscovery";
import { SourceTypeStep } from "../../../../data-ingestion/components/SourceTypeStep";
import type { SourceSystem } from "../../../../data-ingestion/types";

/** The two screens of the add-source sub-flow: pick a type, then fill it in. */
export type AddSourceStep = "type" | "detail";

type AddSourceFlowProps = {
  step: AddSourceStep;
  selectedType: SourceSystem;
  /**
   * The source types that can actually be staged here. Phase 2 wires GitHub
   * only; Jira and Upload still render in the grid (with a "Soon" badge) so the
   * shape of the flow does not change when later phases enable them.
   */
  availableTypes: SourceSystem[];
  onSelectType: (type: SourceSystem) => void;

  // GitHub detail — the picker is fully controlled by the wizard so the footer's
  // "Add to list" can read the resolved selection.
  tokenNames: string[];
  githubTokenName: string;
  onGithubTokenNameChange: (name: string) => void;
  /** Must be stable (a state setter) — the picker only re-reports on change. */
  onGithubSelectionChange: (selection: DiscoverySelection[]) => void;
  isBusy?: boolean;
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
  tokenNames,
  githubTokenName,
  onGithubTokenNameChange,
  onGithubSelectionChange,
  isBusy = false,
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

  // Detail screen. Phase 2 only stages GitHub; Jira and Upload arrive in later
  // phases and slot in here as extra branches.
  return (
    <GithubRepositoryDiscovery
      tokenNames={tokenNames}
      projectId={null}
      tokenName={githubTokenName}
      onTokenNameChange={onGithubTokenNameChange}
      onSelectionChange={onGithubSelectionChange}
      isConnecting={isBusy}
    />
  );
}
