import {
  KB_URL_PARAM,
  toKnowledgeBaseSearchString,
} from "../../knowledge-base/hooks/useKnowledgeBaseUrlState.ts";
import type { DataSource } from "../types.ts";
import { getConnector } from "./registry.ts";

function repositoriesOf(source: DataSource): string[] {
  return (
    getConnector(source.sourceSystem).knowledgeBase.scopeOf?.(source.details).repositories ?? []
  );
}

/**
 * The knowledge base URL listing the artifacts of one source: its source system,
 * narrowed further where the connector says the knowledge base can express it (a
 * GitHub repository). The filters live entirely in the URL, so a plain link is enough.
 */
export function knowledgeBaseHrefFor(source: DataSource): string {
  const params = new URLSearchParams();
  params.set(KB_URL_PARAM.sources, source.sourceSystem);

  const repositories = repositoriesOf(source);
  if (repositories.length > 0) params.set(KB_URL_PARAM.repositories, repositories.join(","));

  return `/knowledge-base${toKnowledgeBaseSearchString(params)}`;
}

/**
 * What {@link knowledgeBaseHrefFor} filters the knowledge base to, in words: the
 * repository where there is one, otherwise the connector's name for the source
 * system ("Jira").
 */
export function knowledgeBaseScopeLabelFor(source: DataSource): string {
  const [repository] = repositoriesOf(source);
  return repository ?? getConnector(source.sourceSystem).knowledgeBase.label;
}
