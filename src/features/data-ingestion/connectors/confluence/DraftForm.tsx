import { useEffect, useMemo, useState } from "react";
import { AtlassianCredentialAddForm } from "../../../settings/components/atlassian/AtlassianCredentialAddForm.tsx";
import { CredentialSlot } from "../../add-source/CredentialSlot.tsx";
import { useAtlassianCredentialChoice } from "../../add-source/useAtlassianCredentialChoice.ts";
import { ConfluenceConnectStep } from "../../components/ConfluenceConnectStep.tsx";
import type { DraftFormProps } from "../types.ts";
import {
  createConfluenceDraft,
  isValidConfluenceSpaceId,
  type ConfluenceDraftSource,
} from "./draft.ts";

/**
 * Add-source form for Confluence: base URL, numeric space ID and a stored Atlassian
 * credential, with an "add credential" trigger above it. Reports a draft once the
 * URL is set, the space ID is well-formed and a credential is picked.
 */
export function ConfluenceDraftForm({
  isBusy,
  onDraftsChange,
  onSubmit,
  onCompanionOpenChange,
}: DraftFormProps<ConfluenceDraftSource>) {
  const [baseUrl, setBaseUrl] = useState("");
  const [spaceId, setSpaceId] = useState("");
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
      baseUrl.trim() && isValidConfluenceSpaceId(spaceId) && selectedCredential
        ? [
            createConfluenceDraft({
              baseUrl: baseUrl.trim(),
              spaceId: spaceId.trim(),
              credentialName: selectedCredential.displayName,
            }),
          ]
        : [],
    [baseUrl, spaceId, selectedCredential],
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

      <ConfluenceConnectStep
        baseUrl={baseUrl}
        spaceId={spaceId}
        credentialName={credentialName}
        credentials={credentials}
        credentialsLoaded={credentialsLoaded}
        credentialsLoading={credentialsLoading}
        credentialsError={credentialsError}
        isBusy={isBusy}
        onBaseUrlChange={setBaseUrl}
        onSpaceIdChange={setSpaceId}
        onCredentialNameChange={setCredentialName}
        onSubmit={onSubmit}
        suppressMissingCredentialNotice
      />
    </div>
  );
}
