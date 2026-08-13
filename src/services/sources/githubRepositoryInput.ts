/**
 * Parsing for the free-form GitHub repository fields.
 *
 * Shared by the data-ingestion connect form and the project wizard's source
 * step, both of which let the user paste a URL into the owner field instead of
 * filling owner and name separately.
 */

export type GithubRepositoryReference = {
  owner: string;
  name: string;
};

/**
 * Normalizes a single free-form reference such as `owner/repo`, a browser URL
 * or an SSH remote into its owner and name. Returns `null` when the value does
 * not carry both halves.
 */
export function parseGithubRepositoryReference(value: string): GithubRepositoryReference | null {
  const normalizedInput = value
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const [owner, name] = normalizedInput.split("/").filter((segment) => segment.length > 0);

  if (owner && name) {
    return { owner, name };
  }

  return null;
}

/**
 * Extracts a bare GitHub owner (organization or user login) from a free-form
 * value such as `SprintStartProject`, `github.com/SprintStartProject` or a full
 * `https://github.com/SprintStartProject` URL. Unlike
 * {@link parseGithubRepositoryReference} it does not require a repository name —
 * it is used by the org/user discovery flow where only the owner is entered.
 * Returns `null` when no owner segment can be found.
 */
export function parseGithubOwnerInput(value: string): string | null {
  const normalizedInput = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const [owner] = normalizedInput.split("/").filter((segment) => segment.length > 0);

  return owner ?? null;
}

/**
 * Resolves the owner and repository-name inputs of a connect form.
 *
 * A combined reference in the owner field wins, so pasting `owner/repo` or a
 * URL works without touching the second field. Otherwise both fields have to be
 * filled. Returns `null` when neither path yields a complete reference.
 */
export function parseGithubRepositoryInput(
  ownerInput: string,
  repositoryInput: string,
): GithubRepositoryReference | null {
  const trimmedOwnerInput = ownerInput.trim();
  const trimmedRepositoryInput = repositoryInput.trim();
  const parsedOwnerInput = parseGithubRepositoryReference(trimmedOwnerInput);

  if (parsedOwnerInput) {
    return parsedOwnerInput;
  }

  if (trimmedOwnerInput && trimmedRepositoryInput) {
    return {
      owner: trimmedOwnerInput,
      name: trimmedRepositoryInput,
    };
  }

  return null;
}
