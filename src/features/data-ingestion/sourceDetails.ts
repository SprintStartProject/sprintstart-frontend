import type {
  ConfluenceSpaceSourceDetails,
  DataSource,
  GithubRepositoryDetails,
  JiraInstanceSourceDetails,
} from "./types.ts";

/** The repository behind a GitHub card; null for any other source or an unresolved repository. */
export function githubRepositoryOf(source: DataSource): GithubRepositoryDetails | null {
  return source.details.system === "GITHUB" ? source.details.repository : null;
}

/** The instance behind a Jira card; null for any other source. */
export function jiraInstanceOf(source: DataSource): JiraInstanceSourceDetails | null {
  return source.details.system === "JIRA" ? source.details.instance : null;
}

/** The space behind a Confluence card; null for any other source or a card without a connection. */
export function confluenceSpaceOf(source: DataSource): ConfluenceSpaceSourceDetails | null {
  return source.details.system === "CONFLUENCE" ? source.details.space : null;
}
