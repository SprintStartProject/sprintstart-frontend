import { useState, type ReactNode } from "react";
import { FileText, KeyRound, X } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../../../data-ingestion/components/GithubRepositoryDiscovery";
import { JiraConnectStep } from "../../../../data-ingestion/components/JiraConnectStep";
import { SourceTypeStep } from "../../../../data-ingestion/components/SourceTypeStep";
import { FileUploadZone } from "../../../../knowledge-base/components/FileUploadZone";
import { TokenAddForm } from "../../../../settings/components/TokenAddForm";
import { JiraCredentialAddForm } from "../../../../settings/components/jira/JiraCredentialAddForm";
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
  /** Refetches the token list and selects the newly added one. */
  onTokenSaved: () => Promise<void>;
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
  /** Prefill for the inline "add credential" form's account-email field. */
  defaultUserEmail: string | null;
  onDisplayNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onCredentialNameChange: (value: string) => void;
  /** Enter in a field stages the source (guarded), matching "Add to list". */
  onSubmit: () => void;
  /** Refetches credentials and selects the newly added one. */
  onCredentialSaved: () => Promise<void>;
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

/**
 * A "＋ Add credential" toggle that reveals an inline credential form in place,
 * so a user with no stored token/credential can create one without leaving the
 * wizard. Collapsed by default; the form itself owns save + cancel.
 */
function CredentialDisclosure({
  open,
  buttonLabel,
  onOpen,
  children,
}: {
  open: boolean;
  buttonLabel: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  if (open) return <>{children}</>;

  return (
    <Button variant="secondary" size="sm" onClick={onOpen} icon={<KeyRound className="h-4 w-4" />}>
      {buttonLabel}
    </Button>
  );
}

/** GitHub detail with an inline "add token" disclosure above the picker. */
function GithubDetail({ isBusy, github }: { isBusy: boolean; github: GithubDetailProps }) {
  const [showTokenForm, setShowTokenForm] = useState(false);

  return (
    <div className="space-y-4">
      <CredentialDisclosure
        open={showTokenForm}
        buttonLabel="Add GitHub token"
        onOpen={() => setShowTokenForm(true)}
      >
        <TokenAddForm onClose={() => setShowTokenForm(false)} onSaved={github.onTokenSaved} />
      </CredentialDisclosure>

      <GithubRepositoryDiscovery
        tokenNames={github.tokenNames}
        projectId={null}
        tokenName={github.tokenName}
        onTokenNameChange={github.onTokenNameChange}
        onSelectionChange={github.onSelectionChange}
        isConnecting={isBusy}
      />
    </div>
  );
}

/** Jira detail with an inline "add credential" disclosure above the form. */
function JiraDetail({ isBusy, jira }: { isBusy: boolean; jira: JiraDetailProps }) {
  const [showCredentialForm, setShowCredentialForm] = useState(false);

  return (
    <div className="space-y-4">
      <CredentialDisclosure
        open={showCredentialForm}
        buttonLabel="Add Jira credential"
        onOpen={() => setShowCredentialForm(true)}
      >
        <JiraCredentialAddForm
          defaultUserEmail={jira.defaultUserEmail}
          onClose={() => setShowCredentialForm(false)}
          onSaved={jira.onCredentialSaved}
        />
      </CredentialDisclosure>

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
    </div>
  );
}

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
 * The sub-flow is presentational (the wizard owns which screen is shown and the
 * captured detail state); the only local state it owns is the collapsed/open
 * state of each inline credential form.
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
    return <JiraDetail isBusy={isBusy} jira={jira} />;
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

  return <GithubDetail isBusy={isBusy} github={github} />;
}
