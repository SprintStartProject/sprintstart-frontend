import type {
  BitbucketRepositoryDetails,
  ConfluenceSpaceSourceDetails,
  DataSource,
  GithubRepositoryDetails,
  JiraInstanceSourceDetails,
  NotionWorkspaceSourceDetails,
} from "./types.ts";

/** The repository behind a GitHub card; null for any other source or an unresolved repository. */
export function githubRepositoryOf(source: DataSource): GithubRepositoryDetails | null {
  return source.details.system === "GITHUB" ? source.details.repository : null;
}

/** The repository behind a Bitbucket card; null for any other source or an unresolved repository. */
export function bitbucketRepositoryOf(source: DataSource): BitbucketRepositoryDetails | null {
  return source.details.system === "BITBUCKET" ? source.details.repository : null;
}

/** The instance behind a Jira card; null for any other source. */
export function jiraInstanceOf(source: DataSource): JiraInstanceSourceDetails | null {
  return source.details.system === "JIRA" ? source.details.instance : null;
}

/** The space behind a Confluence card; null for any other source or a card without a connection. */
export function confluenceSpaceOf(source: DataSource): ConfluenceSpaceSourceDetails | null {
  return source.details.system === "CONFLUENCE" ? source.details.space : null;
}

/** The workspace behind a Notion card; null for any other source or one without workspace details. */
export function notionWorkspaceOf(source: DataSource): NotionWorkspaceSourceDetails | null {
  return source.details.system === "NOTION" ? source.details.workspace : null;
}
