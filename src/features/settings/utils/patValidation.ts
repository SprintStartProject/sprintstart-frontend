/**
 * A GitHub Personal Access Token is either a classic PAT (`ghp_`) or a
 * fine-grained PAT (`github_pat_`). Anything else is rejected client-side
 * before round-tripping to the backend.
 */
const PAT_PATTERN = /^(ghp_|github_pat_)[A-Za-z0-9_]+$/;

/** True when `value` looks like a valid GitHub PAT prefix + body. */
export function isValidGithubPat(value: string): boolean {
  return PAT_PATTERN.test(value.trim());
}

export const INVALID_TOKEN_MESSAGE =
  "Invalid token format. Use a classic PAT (ghp_...) or a fine-grained PAT (github_pat_...).";
