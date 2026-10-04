import { useEffect, useMemo, useState } from "react";
import { AtlassianCredentialAddForm } from "../../../settings/components/atlassian/AtlassianCredentialAddForm.tsx";
import { CredentialSlot } from "../../add-source/CredentialSlot.tsx";
import { useAtlassianCredentialChoice } from "../../add-source/useAtlassianCredentialChoice.ts";
import { BitbucketRepositoryDiscovery } from "../../components/BitbucketRepositoryDiscovery.tsx";
import type { DiscoverySelection } from "../../components/RepositoryDiscovery.tsx";
import type { DraftFormProps } from "../types.ts";
import { createBitbucketDraftFromDiscovery, type BitbucketDraftSource } from "./draft.ts";

/**
 * Add-source form for Bitbucket: workspace repository discovery with an "add credential"
 * trigger above it. It holds the picked repositories and the Atlassian credential they are
 * discovered with, and reports one draft per ticked repository.
 */
export function BitbucketDraftForm({
  context,
  isBusy,
  onDraftsChange,
  onCompanionOpenChange,
}: DraftFormProps<BitbucketDraftSource>) {
  const [selection, setSelection] = useState<DiscoverySelection[]>([]);
  const {
    credentials,
    credentialsLoaded,
    credentialsLoading,
    credentialsError,
    credentialName,
    setCredentialName,
    handleCredentialSaved,
  } = useAtlassianCredentialChoice();

  const drafts = useMemo(
    () =>
      credentialName
        ? selection.map((picked) => createBitbucketDraftFromDiscovery(picked, credentialName))
        : [],
    [selection, credentialName],
  );

  useEffect(() => {
    onDraftsChange(drafts);
  }, [drafts, onDraftsChange]);

  // Only hint "nothing stored" once the list has loaded, so the chip does not
  // flash while credentials are still being fetched.
  const missingCredential = credentialsLoaded && credentials.length === 0;

  return (
    <div className="space-y-4">
      <CredentialSlot
        buttonLabel="Add Atlassian credential"
        panelTitle="New Atlassian credential"
        onCompanionOpenChange={onCompanionOpenChange}
        missingLabel={missingCredential ? "No credential yet" : undefined}
        renderForm={(close, embedded) => (
          <AtlassianCredentialAddForm
            defaultUserEmail={null}
            onClose={close}
            onSaved={handleCredentialSaved}
            embedded={embedded}
          />
        )}
      />

      <BitbucketRepositoryDiscovery
        credentials={credentials}
        credentialsLoaded={credentialsLoaded}
        credentialsLoading={credentialsLoading}
        credentialsError={credentialsError}
        credentialName={credentialName}
        onCredentialNameChange={setCredentialName}
        projectId={context.projectId}
        onSelectionChange={setSelection}
        isConnecting={isBusy}
        suppressMissingCredentialNotice
      />
    </div>
  );
}
