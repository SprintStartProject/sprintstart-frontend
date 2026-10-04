import { useEffect, useState } from "react";
import type { AtlassianCredentialDto } from "../../../services/sources/atlassianService.ts";
import { useAtlassianCredentials } from "../../settings/hooks/useAtlassianCredentials.ts";

/**
 * The stored Atlassian credential a Jira or Confluence form picks, with the list it picks
 * from. The first credential is adopted as soon as the list arrives and a still-valid choice
 * is kept, so the form is usable on first open; a credential added inline is selected at once.
 */
export function useAtlassianCredentialChoice() {
  const { credentials, loaded, error, isRefreshing, reload, addCredentialLocally } =
    useAtlassianCredentials(true);
  const [credentialName, setCredentialName] = useState("");

  useEffect(() => {
    if (!loaded || isRefreshing) return;

    void Promise.resolve().then(() => {
      setCredentialName((current) => {
        if (credentials.length === 0) return "";

        return current && credentials.some((credential) => credential.displayName === current)
          ? current
          : credentials[0].displayName;
      });
    });
  }, [credentials, loaded, isRefreshing]);

  // Adopt the new credential locally and select it right away, so a successful add is
  // reflected even if the reload fails or is aborted; the reload then reconciles with the server.
  const handleCredentialSaved = async (credential: AtlassianCredentialDto) => {
    addCredentialLocally(credential);
    setCredentialName(credential.displayName);
    await reload();
  };

  return {
    credentials,
    credentialsLoaded: loaded,
    credentialsLoading: isRefreshing,
    credentialsError: error,
    credentialName,
    setCredentialName,
    selectedCredential: credentials.find((credential) => credential.displayName === credentialName),
    handleCredentialSaved,
  };
}
