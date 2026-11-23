/** Where a file can be read at its source. */
export interface SourceLinks {
  /** The host's name, such as `GitHub`. */
  provider: string;
  /** The file as it is on the default branch. */
  file: string;
  /** Who changed the file and when, or `null` when the host's address for it is not known. */
  history: string | null;
}

const REPOSITORY = /^(github|bitbucket):([\w.-]+\/[\w.-]+)$/;

function encodedPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * The addresses of a file on its host, from the repository key the ranking carries
 * (`github:owner/repo`, `bitbucket:workspace/repo`) and the file's path.
 *
 * They point at `HEAD`, which the host resolves to the default branch, so the branch's name is not
 * needed. A repository on a host this does not know has no links.
 */
export function sourceLinks(repository: string, path: string): SourceLinks | null {
  const match = REPOSITORY.exec(repository);
  if (!match) return null;
  const [, host, slug] = match;
  const file = encodedPath(path);
  if (host === "github") {
    return {
      provider: "GitHub",
      file: `https://github.com/${slug}/blob/HEAD/${file}`,
      history: `https://github.com/${slug}/commits/HEAD/${file}`,
    };
  }
  return {
    provider: "Bitbucket",
    file: `https://bitbucket.org/${slug}/src/HEAD/${file}`,
    history: null,
  };
}
