/** The Knowledge Base page's URL: its query-string keys and how a set of them is written back. */

/**
 * Query-string keys the Knowledge Base page owns. Short, human-readable names, because these
 * URLs are meant to be pasted into chats and tickets.
 */
export const KB_URL_PARAM = {
  tab: "tab",
  search: "q",
  sources: "sources",
  repositories: "repos",
  format: "format",
  languages: "languages",
  page: "page",
  size: "size",
  sort: "sort",
  from: "from",
  to: "to",
  artifact: "artifact",
} as const;

/**
 * Serialises params back into a `location.search` string (`""` when empty). Commas and slashes
 * are left readable — `?sources=GITHUB,JIRA&repos=acme/api` rather than `%2C`/`%2F` — both are
 * legal in a query string and `URLSearchParams` reads them back unchanged.
 */
export function toKnowledgeBaseSearchString(params: URLSearchParams): string {
  const query = params.toString().replace(/%2C/gi, ",").replace(/%2F/gi, "/");
  return query ? `?${query}` : "";
}
