import { describe, expect, it } from "vitest";
import { GitBranch } from "lucide-react";
import {
  knowledgeBaseHrefFor,
  knowledgeBaseScopeLabelFor,
} from "../../../../../src/features/data-ingestion/connectors/knowledgeBaseLink";
import { deriveSourceStatus } from "../../../../../src/features/data-ingestion/data";
import type { DataSource } from "../../../../../src/features/data-ingestion/types";
import { parseKnowledgeBaseSearch } from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBaseUrlState";

const base: DataSource = {
  sourceId: "source-github",
  sourceSystem: "GITHUB",
  name: "GitHub Repository",
  type: "GitHub",
  icon: GitBranch,
  status: "connected",
  statusView: deriveSourceStatus({ hasErrors: false, hasNeverSynced: false }),
  artifacts: 10,
  lastSync: "2026-07-05",
  errors: 0,
  latestIngestedCount: 10,
  latestUpdatedCount: 0,
  totalArtifactCount: 10,
  deletedCount: 0,
  sharesSourceSystem: false,
  lastRunAt: null,
  failedItems: [],
  details: {
    system: "GITHUB",
    repository: {
      owner: "acme",
      name: "monorepo",
      repositoryId: "repo-1",
      fullName: "acme/monorepo",
      url: "https://github.com/acme/monorepo",
      enabled: true,
    },
    syncTimes: { commits: null, issues: null, pullRequests: null },
  },
  description: "",
};

function parse(href: string) {
  const [, search = ""] = href.split("?");
  return parseKnowledgeBaseSearch(new URLSearchParams(search));
}

describe("knowledgeBaseHrefFor", () => {
  it("scopes a GitHub source with a resolved repository to that repository", () => {
    const href = knowledgeBaseHrefFor(base);

    expect(href).toBe("/knowledge-base?sources=GITHUB&repos=acme/monorepo");

    const state = parse(href);
    expect([...state.sources]).toEqual(["GITHUB"]);
    expect([...state.repositories]).toEqual(["acme/monorepo"]);
  });

  it("falls back to the source system when the GitHub repository is unresolved", () => {
    const href = knowledgeBaseHrefFor({
      ...base,
      details: {
        system: "GITHUB",
        repository: null,
        syncTimes: { commits: null, issues: null, pullRequests: null },
      },
    });

    expect(href).toBe("/knowledge-base?sources=GITHUB");
    expect([...parse(href).repositories]).toEqual([]);
  });

  it("scopes a Jira source to the Jira system only", () => {
    const href = knowledgeBaseHrefFor({
      ...base,
      sourceSystem: "JIRA",
      details: {
        system: "JIRA",
        instance: {
          instanceUrl: "https://acme.atlassian.net",
          displayName: "Team board",
          credentialName: "default",
          credentialUserEmail: "jira@corp.com",
        },
        syncTimes: { issues: null },
      },
    });

    expect(href).toBe("/knowledge-base?sources=JIRA");

    const state = parse(href);
    expect([...state.sources]).toEqual(["JIRA"]);
    expect([...state.repositories]).toEqual([]);
  });
});

describe("knowledgeBaseScopeLabelFor", () => {
  it("names the repository for a resolved GitHub source", () => {
    expect(knowledgeBaseScopeLabelFor(base)).toBe("acme/monorepo");
  });

  it("falls back to the connector's name for the source system", () => {
    expect(
      knowledgeBaseScopeLabelFor({
        ...base,
        details: {
          system: "GITHUB",
          repository: null,
          syncTimes: { commits: null, issues: null, pullRequests: null },
        },
      }),
    ).toBe("GitHub");
  });
});
