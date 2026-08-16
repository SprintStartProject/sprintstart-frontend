import { FileText, X } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../../../data-ingestion/components/GithubRepositoryDiscovery";
import { JiraConnectStep } from "../../../../data-ingestion/components/JiraConnectStep";
import { SourceTypeStep } from "../../../../data-ingestion/components/SourceTypeStep";
import { FileUploadZone } from "../../../../knowledge-base/components/FileUploadZone";
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

/** Upload detail — files are staged in memory and uploaded during provisioning. */
type UploadDetailProps = {
  files: File[];
  /** Appends the newly selected/dropped valid files to the staged list. */
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
};

type AddSourceFlowProps = {
  step: AddSourceStep;
  selectedType: SourceSystem;
  /**
   * The source types that can actually be staged here. Any type not listed
   * still renders in the grid (with a "Soon" badge), so the shape of the flow
   * does not change as later phases enable them.
   */
  availableTypes: SourceSystem[];
  onSelectType: (type: SourceSystem) => void;
  isBusy?: boolean;
  github: GithubDetailProps;
  jira: JiraDetailProps;
  upload: UploadDetailProps;
};

/** The staged-files detail screen for an upload source. */
function UploadDetail({ files, onAddFiles, onRemoveFile }: UploadDetailProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-app-text">Upload documentation</p>
        <p className="mt-1 text-sm leading-relaxed text-app-text-muted">
          Files are staged now and uploaded right after the project is created.
        </p>
      </div>

      <FileUploadZone onUpload={onAddFiles} isUploading={false} />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-app-text-muted" />
              <span className="max-w-[16rem] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => onRemoveFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  upload,
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

  if (selectedType === "UPLOAD") {
    return (
      <UploadDetail
        files={upload.files}
        onAddFiles={upload.onAddFiles}
        onRemoveFile={upload.onRemoveFile}
      />
    );
  }

  // GitHub detail.
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
