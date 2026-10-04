import { useEffect, useMemo, useState } from "react";
import { AtlassianCredentialAddForm } from "../../../settings/components/atlassian/AtlassianCredentialAddForm.tsx";
import { CredentialSlot } from "../../add-source/CredentialSlot.tsx";
import { useAtlassianCredentialChoice } from "../../add-source/useAtlassianCredentialChoice.ts";
import { JiraConnectStep } from "../../components/JiraConnectStep.tsx";
import type { DraftFormProps } from "../types.ts";
import { createJiraDraft, type JiraDraftSource } from "./draft.ts";

/**
 * Add-source form for Jira: display name, instance URL and a stored Atlassian credential,
 * with an "add credential" trigger above it. Reports a draft once all three are filled in.
 */
export function JiraDraftForm({
  isBusy,
  onDraftsChange,
  onSubmit,
  onCompanionOpenChange,
}: DraftFormProps<JiraDraftSource>) {
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const {
    credentials,
    credentialsLoaded,
    credentialsLoading,
    credentialsError,
    credentialName,
    setCredentialName,
    selectedCredential,
    handleCredentialSaved,
  } = useAtlassianCredentialChoice();

  const drafts = useMemo(
    () =>
      displayName.trim() && url.trim() && selectedCredential
        ? [
            createJiraDraft({
              displayName: displayName.trim(),
              url: url.trim(),
              userEmail: selectedCredential.userEmail,
              tokenName: selectedCredential.displayName,
            }),
          ]
        : [],
    [displayName, url, selectedCredential],
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

      <JiraConnectStep
        displayName={displayName}
        url={url}
        credentialName={credentialName}
        credentials={credentials}
        credentialsLoaded={credentialsLoaded}
        credentialsLoading={credentialsLoading}
        credentialsError={credentialsError}
        isBusy={isBusy}
        canIngest
        errorMessage={null}
        onDisplayNameChange={setDisplayName}
        onUrlChange={setUrl}
        onCredentialNameChange={setCredentialName}
        onSubmit={onSubmit}
        suppressMissingCredentialNotice
      />
    </div>
  );
}
