/**
 * Parsing for the free-form Bitbucket workspace and repository fields.
 *
 * The Bitbucket counterpart of `githubRepositoryInput.ts`: the connect flows let
 * the user paste a URL into the workspace field instead of filling workspace and
 * slug separately. A Bitbucket repository is addressed as `workspace/slug`.
 *
 * Bitbucket workspace ids and repository slugs are always lowercase, while the
 * backend matches connections by exact coordinates. Every parser here lowercases
 * what it returns, so `Acme/Widgets` resolves to the existing `acme/widgets`
 * connection instead of becoming a second one.
 */

export type BitbucketRepositoryReference = {
  workspace: string;
  slug: string;
};

/**
 * Strips the host part of a browser URL, an HTTPS clone URL (which may carry a
 * `user@`) or an SSH remote, and the leading slashes, leaving the lowercased
 * path segments. A query string or fragment (`?foo=bar`, `#readme`) is dropped
 * first so it never ends up inside the last segment.
 */
function toPathSegments(value: string): string[] {
  return value
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/^(?:https?|ssh):\/\/(?:[^@/]+@)?bitbucket\.org\//i, "")
    .replace(/^bitbucket\.org\//i, "")
    .replace(/^git@bitbucket\.org:/i, "")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.toLowerCase());
}

/**
 * Normalizes a single free-form reference such as `workspace/slug`, a browser
 * URL, an HTTPS clone URL or an SSH remote into its workspace and slug. A URL
 * that points deeper into the repository (`/src/main`, `/pull-requests/3`) still
 * resolves to the repository. Returns `null` when the value does not carry both
 * halves.
 */
export function parseBitbucketRepositoryReference(
  value: string,
): BitbucketRepositoryReference | null {
  const [workspace, rawSlug] = toPathSegments(value);
  const slug = rawSlug?.replace(/\.git$/i, "");

  if (workspace && slug) {
    return { workspace, slug };
  }

  return null;
}

/**
 * Extracts a bare workspace id from a free-form value such as `acme`,
 * `bitbucket.org/acme` or a full `https://bitbucket.org/acme/` URL. Unlike
 * {@link parseBitbucketRepositoryReference} it does not require a slug: it is
 * used by the discovery flow, where only the workspace is entered. Returns
 * `null` when no workspace segment can be found.
 */
export function parseBitbucketWorkspaceInput(value: string): string | null {
  const [workspace] = toPathSegments(value);

  return workspace ?? null;
}

/**
 * Resolves the workspace and slug inputs of a connect form.
 *
 * A combined reference in the workspace field wins, so pasting `workspace/slug`
 * or a URL works without touching the second field. Otherwise both fields have
 * to be filled. Returns `null` when neither path yields a complete reference.
 */
export function parseBitbucketRepositoryInput(
  workspaceInput: string,
  slugInput: string,
): BitbucketRepositoryReference | null {
  const trimmedWorkspaceInput = workspaceInput.trim();
  const trimmedSlugInput = slugInput.trim();
  const parsedWorkspaceInput = parseBitbucketRepositoryReference(trimmedWorkspaceInput);

  if (parsedWorkspaceInput) {
    return parsedWorkspaceInput;
  }

  if (trimmedWorkspaceInput && trimmedSlugInput) {
    return {
      workspace: trimmedWorkspaceInput.toLowerCase(),
      slug: trimmedSlugInput.toLowerCase(),
    };
  }

  return null;
}
