import { apiClient } from "../apiClient.ts";

// ---- Credentials ----

export type AddAtlassianCredentialRequest = {
  userEmail: string;
  tokenName: string;
  /** The actual Atlassian API token. */
  authToken: string;
};

export type DeleteAtlassianCredentialRequest = {
  userEmail: string;
  tokenName: string;
};

export type ChangeAtlassianCredentialNameRequest = {
  userEmail: string;
  oldName: string;
  newName: string;
};

export type ChangeAtlassianCredentialTokenRequest = {
  userEmail: string;
  tokenName: string;
  newToken: string;
};

/**
 * A stored credential as returned by the backend: only `userEmail` plus the
 * credential/token name (`displayName`). The token secret is never returned.
 * Shared by the Jira and Confluence connectors.
 */
export type AtlassianCredentialDto = {
  userEmail: string;
  displayName: string;
};

/**
 * Stores a new Atlassian credential for a user. Credentials are keyed by the
 * `(userEmail, tokenName)` pair.
 *
 * @throws ApiError — 400 when a credential with that name already exists,
 *   403 for an insufficient role.
 */
export async function addAtlassianCredential(
  request: AddAtlassianCredentialRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/atlassian/credentials", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Lists the Atlassian credentials owned by the authenticated user. Token
 * secrets are never returned.
 *
 * @param signal - Optional AbortSignal for cancelling an in-flight request.
 * @throws ApiError when the request fails.
 */
export async function getMyAtlassianCredentials(
  signal?: AbortSignal,
): Promise<AtlassianCredentialDto[]> {
  return apiClient.fetch<AtlassianCredentialDto[]>("/api/v1/atlassian/credentials", {
    signal,
  });
}

/**
 * Deletes a stored Atlassian credential identified by its `(userEmail, tokenName)`.
 *
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function deleteAtlassianCredential(
  request: DeleteAtlassianCredentialRequest,
): Promise<void> {
  await apiClient.fetch<void>("/api/v1/atlassian/credentials", {
    method: "DELETE",
    body: JSON.stringify(request),
  });
}

/**
 * Renames a stored Atlassian credential.
 *
 * @returns The credential in its renamed state.
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function changeAtlassianCredentialName(
  request: ChangeAtlassianCredentialNameRequest,
): Promise<AtlassianCredentialDto> {
  return apiClient.fetch<AtlassianCredentialDto>("/api/v1/atlassian/credentials/patch/name", {
    method: "PATCH",
    body: JSON.stringify(request),
  });
}

/**
 * Replaces the token secret of a stored Atlassian credential.
 *
 * @returns The (unchanged) credential metadata.
 * @throws ApiError — 404 when the credential is unknown, 403 for an insufficient role.
 */
export async function changeAtlassianCredentialToken(
  request: ChangeAtlassianCredentialTokenRequest,
): Promise<AtlassianCredentialDto> {
  return apiClient.fetch<AtlassianCredentialDto>("/api/v1/atlassian/credentials/patch/token", {
    method: "PATCH",
    body: JSON.stringify(request),
  });
}
