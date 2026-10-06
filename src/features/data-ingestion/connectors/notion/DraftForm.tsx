import { useEffect, useMemo, useState } from "react";
import type { NotionCredentialDto } from "../../../../services/sources/notionService.ts";
import { NotionCredentialAddForm } from "../../../settings/components/notion/NotionCredentialAddForm.tsx";
import { useNotionCredentials } from "../../../settings/hooks/useNotionCredentials.ts";
import { CredentialSlot } from "../../add-source/CredentialSlot.tsx";
import type { DraftFormProps } from "../types.ts";
import { createNotionDraft, type NotionDraftSource } from "./draft.ts";
import { NotionWorkspacePicker, type NotionWorkspaceSelection } from "./WorkspacePicker.tsx";

/**
 * Add-source form for Notion: an "add credential" trigger above the workspace picker.
 * It holds the chosen credential and the workspace the picker reports, and reports one
 * draft once a workspace can be connected.
 */
export function NotionDraftForm({
  context,
  isBusy,
  onDraftsChange,
  onCompanionOpenChange,
}: DraftFormProps<NotionDraftSource>) {
  const { credentials, loaded, addCredentialLocally, reload } = useNotionCredentials(true);
  const [credentialName, setCredentialName] = useState("");
  const [workspace, setWorkspace] = useState<NotionWorkspaceSelection | null>(null);

  // Adopt the first credential as soon as the list arrives and keep a still-valid choice,
  // so the form is usable on first open.
  useEffect(() => {
    if (!loaded) return;

    void Promise.resolve().then(() => {
      setCredentialName((current) => {
        if (credentials.length === 0) return "";

        return current && credentials.some((credential) => credential.name === current)
          ? current
          : credentials[0].name;
      });
    });
  }, [credentials, loaded]);

  // Adopt the new credential locally and select it right away, so a successful add is
  // reflected even if the reload fails or is aborted; the reload then reconciles with the server.
  const handleCredentialSaved = async (credential: NotionCredentialDto) => {
    addCredentialLocally(credential);
    setCredentialName(credential.name);
    await reload();
  };

  const drafts = useMemo(() => (workspace ? [createNotionDraft(workspace)] : []), [workspace]);

  useEffect(() => {
    onDraftsChange(drafts);
  }, [drafts, onDraftsChange]);

  // Only hint "nothing stored" once the list has loaded, so the chip does not
  // flash while credentials are still being fetched.
  const missingCredential = loaded && credentials.length === 0;

  return (
    <div className="space-y-4">
      <CredentialSlot
        buttonLabel="Add Notion credential"
        panelTitle="New Notion credential"
        onCompanionOpenChange={onCompanionOpenChange}
        missingLabel={missingCredential ? "No credential yet" : undefined}
        renderForm={(close, embedded) => (
          <NotionCredentialAddForm
            onClose={close}
            onSaved={handleCredentialSaved}
            embedded={embedded}
          />
        )}
      />

      <NotionWorkspacePicker
        credentials={credentials}
        credentialName={credentialName}
        onCredentialNameChange={setCredentialName}
        projectId={context.projectId}
        onWorkspaceChange={setWorkspace}
        isConnecting={isBusy}
      />
    </div>
  );
}
