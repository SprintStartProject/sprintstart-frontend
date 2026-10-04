import { useEffect, useMemo, useState } from "react";
import { useGithubTokens } from "../../../settings/hooks/useGithubTokens.ts";
import { TokenAddForm } from "../../../settings/components/TokenAddForm.tsx";
import { CredentialSlot } from "../../add-source/CredentialSlot.tsx";
import {
  GithubRepositoryDiscovery,
  type DiscoverySelection,
} from "../../components/GithubRepositoryDiscovery.tsx";
import type { DraftFormProps } from "../types.ts";
import { createDraftSourceFromDiscovery, type GithubDraftSource } from "./draft.ts";

/**
 * Add-source form for GitHub: repository discovery with an "add token" trigger above it.
 * It holds the picked repositories and the token they are discovered with, and reports
 * one draft per ticked repository.
 */
export function GithubDraftForm({
  context,
  isBusy,
  onDraftsChange,
  onCompanionOpenChange,
}: DraftFormProps<GithubDraftSource>) {
  // The token list is owned here so an inline "add token" can refresh it and
  // auto-select the new token. It falls back to the host's list until it has
  // loaded so discovery works on the first open without waiting for the refetch.
  const { tokenNames, tokensLoaded, loadTokenNames, addTokenNameLocally } = useGithubTokens();
  const effectiveTokenNames = tokensLoaded ? tokenNames : context.tokenNames;

  const [tokenName, setTokenName] = useState(context.tokenNames[0] ?? "");
  const [selection, setSelection] = useState<DiscoverySelection[]>([]);

  // Adopt the first token as soon as the list arrives (and heal a stale
  // selection) so discovery is usable on the first open.
  useEffect(() => {
    if (effectiveTokenNames.length === 0) return;

    void Promise.resolve().then(() => {
      setTokenName((current) =>
        current && effectiveTokenNames.includes(current) ? current : effectiveTokenNames[0],
      );
    });
  }, [effectiveTokenNames]);

  const drafts = useMemo(
    () => selection.map((picked) => createDraftSourceFromDiscovery(picked, tokenName)),
    [selection, tokenName],
  );

  useEffect(() => {
    onDraftsChange(drafts);
  }, [drafts, onDraftsChange]);

  // Inline token creation: adopt the new token locally and select it right away, so a
  // successful add is reflected even if the reload fails or is aborted; the reload
  // then reconciles with the server.
  const handleTokenSaved = async (savedName: string) => {
    addTokenNameLocally(savedName);
    setTokenName(savedName);
    await loadTokenNames();
  };

  return (
    <div className="space-y-4">
      <CredentialSlot
        buttonLabel="Add GitHub token"
        panelTitle="New GitHub token"
        renderForm={(close, embedded) => (
          <TokenAddForm onClose={close} onSaved={handleTokenSaved} embedded={embedded} />
        )}
        onCompanionOpenChange={onCompanionOpenChange}
        missingLabel={effectiveTokenNames.length > 0 ? undefined : "No token yet"}
      />

      <GithubRepositoryDiscovery
        tokenNames={effectiveTokenNames}
        projectId={context.projectId}
        projectName={context.projectName}
        tokenName={tokenName}
        onTokenNameChange={setTokenName}
        onSelectionChange={setSelection}
        isConnecting={isBusy}
        suppressMissingTokenNotice
      />
    </div>
  );
}
