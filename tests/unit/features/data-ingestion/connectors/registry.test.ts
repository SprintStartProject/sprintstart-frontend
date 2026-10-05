import { describe, expect, it } from "vitest";
import {
  CHAT_SOURCE_SYSTEMS,
  CONNECTORS,
  CONNECTOR_LIST,
  KNOWLEDGE_BASE_SOURCE_ORDER,
  SCHEDULED_SOURCE_SYSTEMS,
  findConnectorById,
  getConnector,
  hasRepositoryFacet,
  sourceSystemOfCitation,
} from "../../../../../src/features/data-ingestion/connectors/registry";
import {
  SOURCE_SYSTEMS,
  toSourceSystem,
} from "../../../../../src/features/data-ingestion/connectors/sourceSystems";
import { createDataSource, SOURCE_META } from "../../../../../src/features/data-ingestion/data";
import type { SourceInstanceIngestionStatus } from "../../../../../src/features/data-ingestion/types";
import { getConnectorMeta } from "../../../../../src/features/connectors/data";

describe("connector registry", () => {
  it("has exactly one definition for every source system, in offering order", () => {
    expect(CONNECTOR_LIST.map((definition) => definition.meta.system)).toEqual([...SOURCE_SYSTEMS]);

    for (const system of SOURCE_SYSTEMS) {
      expect(CONNECTORS[system].meta.system).toBe(system);
      expect(getConnector(system)).toBe(CONNECTORS[system]);
    }
  });

  it("gives every connector complete labels and wording", () => {
    for (const { meta } of CONNECTOR_LIST) {
      expect(meta.label).toBeTruthy();
      expect(meta.name).toBeTruthy();
      expect(meta.noun.singular).toBeTruthy();
      expect(meta.noun.plural).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.icon).toBeDefined();
      expect(meta.connectorId).toBe(meta.connectorId.toLowerCase());
    }
  });

  it("uses distinct connector ids", () => {
    const ids = CONNECTOR_LIST.map((definition) => definition.meta.connectorId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("finds a definition by its backend connector id", () => {
    expect(findConnectorById("jira")?.meta.system).toBe("JIRA");
    expect(findConnectorById("unknown")).toBeNull();
  });

  it("derives SOURCE_META from the definitions", () => {
    for (const { meta } of CONNECTOR_LIST) {
      expect(SOURCE_META[meta.system]).toEqual({
        name: meta.name,
        type: meta.label,
        icon: meta.icon,
        description: meta.description,
      });
    }
  });

  it("derives the chat filter and the schedulable systems from the definitions' flags", () => {
    expect(CHAT_SOURCE_SYSTEMS).toEqual(
      CONNECTOR_LIST.filter((definition) => definition.chat.filterable).map(
        (definition) => definition.meta.system,
      ),
    );
    expect(SCHEDULED_SOURCE_SYSTEMS).toEqual([
      "GITHUB",
      "JIRA",
      "CONFLUENCE",
      "BITBUCKET",
      "NOTION",
    ]);
  });

  it("words the connectors modal from the registry and falls back to the backend name", () => {
    const dto = (id: string, name: string) => ({
      id,
      name,
      enabled: true,
      firstConfiguredAt: null,
      lastConfiguredAt: null,
    });
    const github = getConnectorMeta(dto("github", "github"));
    const jira = getConnectorMeta(dto("jira", "Jira Cloud"));

    expect(github.label).toBe("GitHub Repository Connector");
    expect(github.icon).toBe(CONNECTORS.GITHUB.meta.icon);
    expect(jira.label).toBe("Jira Cloud");
  });

  it("parses a source system from free text ignoring case", () => {
    expect(toSourceSystem("github")).toBe("GITHUB");
    expect(toSourceSystem("Confluence")).toBe("CONFLUENCE");
    expect(toSourceSystem("Bitbucket")).toBe("BITBUCKET");
    expect(toSourceSystem("notion")).toBe("NOTION");
    expect(toSourceSystem("sonarqube")).toBeNull();
  });

  describe("actions", () => {
    const status: SourceInstanceIngestionStatus = {
      sourceSystem: "GITHUB",
      sourceId: "acme/monorepo",
      displayName: "acme/monorepo",
      repositoryId: "repo-1",
      owner: "acme",
      name: "monorepo",
      sourceUrl: "https://github.com/acme/monorepo",
      connectionStatus: "CONNECTED",
      enabled: true,
      lastRunTime: null,
      ingestedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      failedCount: 0,
      failedItems: [],
      artifactCount: 0,
      lastCommitsSyncAt: null,
      lastIssuesSyncAt: null,
      lastPullRequestsSyncAt: null,
    };

    it("gives uploads no action, no identity card and no run filter", () => {
      expect(CONNECTORS.UPLOAD.actions).toEqual({});
      expect(CONNECTORS.UPLOAD.DetailsSection).toBeNull();
      expect(CONNECTORS.UPLOAD.runFilter).toBeUndefined();
    });

    it("gives every other connector an identity card, an update or a sync, and a schedule", () => {
      for (const system of ["GITHUB", "JIRA", "CONFLUENCE", "BITBUCKET", "NOTION"] as const) {
        const { actions, DetailsSection } = CONNECTORS[system];

        expect(DetailsSection).not.toBeNull();
        expect(actions.update ?? actions.manualSync).toBeDefined();
        expect(actions.unlink).toBeDefined();
        expect(actions.setEnabled).toBeDefined();
        expect(actions.schedule).toBeDefined();
      }
    });

    it("runs a connector's update either in the background or to completion, never both", () => {
      for (const { actions } of CONNECTOR_LIST) {
        expect(actions.update !== undefined && actions.manualSync !== undefined).toBe(false);
      }
      expect(CONNECTORS.CONFLUENCE.actions.manualSync).toBeDefined();
      expect(CONNECTORS.NOTION.actions.manualSync).toBeDefined();
    });

    it("offers no action on a card whose source could not be resolved", () => {
      const unresolved = createDataSource({
        definition: CONNECTORS.GITHUB,
        status: null,
        connection: { id: "ps-1", name: "acme/monorepo", type: "GITHUB", status: "CONNECTED" },
      });
      const { update, unlink, setEnabled, schedule } = CONNECTORS.GITHUB.actions;

      expect(update?.isAvailable(unresolved)).toBe(false);
      expect(unlink?.isAvailable(unresolved)).toBe(false);
      expect(setEnabled?.isAvailable(unresolved)).toBe(false);
      expect(schedule?.isAvailable(unresolved)).toBe(false);
    });

    it("scopes the run history by repository id for GitHub and by source reference for Jira", () => {
      const github = createDataSource({ definition: CONNECTORS.GITHUB, status });
      const jira = createDataSource({
        definition: CONNECTORS.JIRA,
        status: { ...status, sourceSystem: "JIRA", sourceId: "https://acme.atlassian.net" },
      });

      expect(CONNECTORS.GITHUB.runFilter?.param).toBe("repositoryId");
      expect(CONNECTORS.GITHUB.runFilter?.valueOf(github)).toBe("repo-1");
      expect(CONNECTORS.JIRA.runFilter?.param).toBe("sourceRef");
      expect(CONNECTORS.JIRA.runFilter?.valueOf(jira)).toBe("https://acme.atlassian.net");
      expect(CONNECTORS.CONFLUENCE.runFilter?.param).toBe("repositoryId");
    });

    it("scopes the run history of a Bitbucket repository by its connection id", () => {
      const bitbucket = createDataSource({
        definition: CONNECTORS.BITBUCKET,
        status: { ...status, sourceSystem: "BITBUCKET", repositoryId: "bb-1" },
      });

      expect(CONNECTORS.BITBUCKET.runFilter?.param).toBe("repositoryId");
      expect(CONNECTORS.BITBUCKET.runFilter?.valueOf(bitbucket)).toBe("bb-1");
    });

    it("offers no action on a Bitbucket card without a connection id", () => {
      const unresolved = createDataSource({
        definition: CONNECTORS.BITBUCKET,
        status: { ...status, sourceSystem: "BITBUCKET", repositoryId: null },
      });
      const { update, unlink } = CONNECTORS.BITBUCKET.actions;

      expect(update?.isAvailable(unresolved)).toBe(false);
      expect(unlink?.isAvailable(unresolved)).toBe(false);
    });

    it("scopes the run history of a Notion workspace by its connection id", () => {
      const notion = createDataSource({
        definition: CONNECTORS.NOTION,
        status: { ...status, sourceSystem: "NOTION", sourceId: "ws-1", repositoryId: null },
        connection: {
          id: "notion-conn-1",
          projectId: "p1",
          workspaceId: "ws-1",
          workspaceName: "Acme",
          workspaceUrl: "https://www.notion.so/acme",
          credentialName: "wiki",
          sourceEnabled: true,
          autoUpdate: false,
          schedule: "every 60 minutes",
          scheduleSpec: { type: "INTERVAL", everyMinutes: 60 },
          nextSyncAt: null,
          lastSyncedAt: null,
          createdAt: "2026-10-05T09:00:00Z",
          updatedAt: "2026-10-05T09:00:00Z",
          version: 1,
        },
      });

      expect(CONNECTORS.NOTION.runFilter?.param).toBe("repositoryId");
      expect(CONNECTORS.NOTION.runFilter?.valueOf(notion)).toBe("notion-conn-1");
      // A run carries the workspace id, or the connection id, as its source reference.
      expect(CONNECTORS.NOTION.runReferences(notion.details)).toEqual(["ws-1", "notion-conn-1"]);
    });

    it("offers no action on a Notion card without a connection record", () => {
      const unresolved = createDataSource({
        definition: CONNECTORS.NOTION,
        status: { ...status, sourceSystem: "NOTION", sourceId: "ws-1", repositoryId: null },
      });
      const { manualSync, unlink, setEnabled, schedule } = CONNECTORS.NOTION.actions;

      expect(CONNECTORS.NOTION.runFilter?.valueOf(unresolved)).toBeNull();
      expect(manualSync?.isAvailable(unresolved)).toBe(false);
      expect(unlink?.isAvailable(unresolved)).toBe(false);
      expect(setEnabled?.isAvailable(unresolved)).toBe(false);
      expect(schedule?.isAvailable(unresolved)).toBe(false);
    });

    it("tells a source apart whose scheduler skips it while auto update is off", () => {
      expect(CONNECTORS.BITBUCKET.actions.schedule?.skipsWhenAutoUpdateOff).toBe(true);
      expect(CONNECTORS.NOTION.actions.schedule?.skipsWhenAutoUpdateOff).toBe(true);
      expect(CONNECTORS.GITHUB.actions.schedule?.skipsWhenAutoUpdateOff).toBeUndefined();
    });

    it("names the unlink cost in each connector's own words", () => {
      expect(CONNECTORS.GITHUB.actions.unlink?.removalHint).toMatch(/repository/);
      expect(CONNECTORS.BITBUCKET.actions.unlink?.removalHint).toMatch(/repository/);
      expect(CONNECTORS.JIRA.actions.unlink?.removalHint).toMatch(/instance/);
      expect(CONNECTORS.CONFLUENCE.actions.unlink?.removalHint).toMatch(/from scratch/);
      expect(CONNECTORS.NOTION.actions.unlink?.removalHint).toMatch(/knowledge base/);
    });
  });

  describe("knowledge base and chat support", () => {
    it("gives every connector its knowledge base wording", () => {
      for (const { knowledgeBase } of CONNECTOR_LIST) {
        expect(knowledgeBase.label).toBeTruthy();
        expect(knowledgeBase.icon).toBeDefined();
      }

      expect(CONNECTORS.GITHUB.knowledgeBase.linkLabel).toBe("Open in GitHub");
      expect(CONNECTORS.BITBUCKET.knowledgeBase.linkLabel).toBe("Open in Bitbucket");
      expect(CONNECTORS.JIRA.knowledgeBase.linkLabel).toBe("Open in Jira");
      expect(CONNECTORS.CONFLUENCE.knowledgeBase.linkLabel).toBe("Open in Confluence");
      expect(CONNECTORS.UPLOAD.knowledgeBase.linkLabel).toBeNull();
    });

    it("lists the knowledge base source facet with uploads last", () => {
      expect(KNOWLEDGE_BASE_SOURCE_ORDER).toEqual([
        "GITHUB",
        "BITBUCKET",
        "JIRA",
        "CONFLUENCE",
        "NOTION",
        "UPLOAD",
      ]);
    });

    it("lets only uploads be deleted and only Confluence and Notion be forced to Markdown", () => {
      expect(
        CONNECTOR_LIST.filter((d) => d.knowledgeBase.deletable).map((d) => d.meta.system),
      ).toEqual(["UPLOAD"]);
      expect(
        CONNECTOR_LIST.filter((d) => d.knowledgeBase.markdown).map((d) => d.meta.system),
      ).toEqual(["CONFLUENCE", "NOTION"]);
    });

    it("shows a metadata view for a GitHub organization and a Bitbucket workspace only", () => {
      for (const system of ["GITHUB", "BITBUCKET"] as const) {
        const view = CONNECTORS[system].knowledgeBase.metadataView;
        const artifact = { artifactType: "ORG_METADATA" } as Parameters<
          NonNullable<typeof view>["appliesTo"]
        >[0];

        expect(view?.appliesTo(artifact)).toBe(true);
        expect(view?.appliesTo({ ...artifact, artifactType: "FILE" })).toBe(false);
      }
      expect(CONNECTORS.GITHUB.knowledgeBase.metadataView?.View).not.toBe(
        CONNECTORS.BITBUCKET.knowledgeBase.metadataView?.View,
      );
      expect(CONNECTORS.JIRA.knowledgeBase.metadataView).toBeUndefined();
    });

    it("offers the repository facet for the repository connectors only", () => {
      expect(hasRepositoryFacet(["GITHUB"])).toBe(true);
      expect(hasRepositoryFacet(["UPLOAD", "BITBUCKET"])).toBe(true);
      expect(hasRepositoryFacet(["JIRA", "CONFLUENCE", "UPLOAD"])).toBe(false);
      expect(hasRepositoryFacet([])).toBe(false);
    });

    it("keeps Bitbucket and Notion out of the chat's source filter", () => {
      expect(CHAT_SOURCE_SYSTEMS).not.toContain("BITBUCKET");
      expect(CHAT_SOURCE_SYSTEMS).not.toContain("NOTION");
    });

    it("scopes the knowledge base to a Bitbucket repository by workspace/slug", () => {
      const source = createDataSource({
        definition: CONNECTORS.BITBUCKET,
        status: {
          sourceSystem: "BITBUCKET",
          sourceId: "acme/widgets",
          displayName: "acme/widgets",
          repositoryId: "bb-1",
          owner: "acme",
          name: "widgets",
          sourceUrl: "https://bitbucket.org/acme/widgets",
          connectionStatus: "CONNECTED",
          enabled: true,
          lastRunTime: null,
          ingestedCount: 0,
          updatedCount: 0,
          deletedCount: 0,
          failedCount: 0,
          failedItems: [],
          artifactCount: 0,
          lastCommitsSyncAt: null,
          lastIssuesSyncAt: null,
          lastPullRequestsSyncAt: null,
        },
      });

      expect(CONNECTORS.BITBUCKET.knowledgeBase.scopeOf?.(source.details)).toEqual({
        repositories: ["acme/widgets"],
      });
    });

    it("has exactly one default citation source", () => {
      expect(
        CONNECTOR_LIST.filter((definition) => definition.chat.isDefaultCitationSource),
      ).toHaveLength(1);
    });

    it.each([
      ["https://github.com/acme/api/pull/4", "pr #4", "GITHUB"],
      ["https://git.corp.example/acme/api/blob/main/a.ts", "a.ts", "GITHUB"],
      ["https://bitbucket.org/acme/api/pull-requests/4", "pr #4", "BITBUCKET"],
      ["https://bitbucket.org/acme/api/src/main/a.ts", "a.ts", "BITBUCKET"],
      ["https://acme.atlassian.net/browse/ENG-1", "jira #eng-1", "JIRA"],
      ["https://acme.atlassian.net/rest/x", "board", "JIRA"],
      ["https://acme.atlassian.net/wiki/spaces/ENG/pages/1", "onboarding", "CONFLUENCE"],
      ["https://wiki.corp.example/wiki/spaces/ENG/pages/1", "onboarding", "CONFLUENCE"],
      ["https://www.notion.so/acme/Handbook-123", "handbook", "NOTION"],
      ["https://acme.notion.site/Handbook-123", "handbook", "NOTION"],
      ["", "handbook.pdf", "UPLOAD"],
    ])("attributes the citation %s (%s) to %s", (url, name, system) => {
      expect(sourceSystemOfCitation(url, name)).toBe(system);
    });
  });
});
