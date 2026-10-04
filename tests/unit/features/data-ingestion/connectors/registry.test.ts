import { describe, expect, it } from "vitest";
import {
  CHAT_SOURCE_SYSTEMS,
  CONNECTORS,
  CONNECTOR_LIST,
  KNOWLEDGE_BASE_SOURCE_ORDER,
  SCHEDULED_SOURCE_SYSTEMS,
  findConnectorById,
  getConnector,
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
    expect(SCHEDULED_SOURCE_SYSTEMS).toEqual(["GITHUB", "JIRA", "CONFLUENCE"]);
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
    expect(toSourceSystem("bitbucket")).toBeNull();
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
      for (const system of ["GITHUB", "JIRA", "CONFLUENCE"] as const) {
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

    it("names the unlink cost in each connector's own words", () => {
      expect(CONNECTORS.GITHUB.actions.unlink?.removalHint).toMatch(/repository/);
      expect(CONNECTORS.JIRA.actions.unlink?.removalHint).toMatch(/instance/);
      expect(CONNECTORS.CONFLUENCE.actions.unlink?.removalHint).toMatch(/from scratch/);
    });
  });

  describe("knowledge base and chat support", () => {
    it("gives every connector its knowledge base wording", () => {
      for (const { knowledgeBase } of CONNECTOR_LIST) {
        expect(knowledgeBase.label).toBeTruthy();
        expect(knowledgeBase.icon).toBeDefined();
      }

      expect(CONNECTORS.GITHUB.knowledgeBase.linkLabel).toBe("Open in GitHub");
      expect(CONNECTORS.JIRA.knowledgeBase.linkLabel).toBe("Open in Jira");
      expect(CONNECTORS.CONFLUENCE.knowledgeBase.linkLabel).toBe("Open in Confluence");
      expect(CONNECTORS.UPLOAD.knowledgeBase.linkLabel).toBeNull();
    });

    it("lists the knowledge base source facet with uploads last", () => {
      expect(KNOWLEDGE_BASE_SOURCE_ORDER).toEqual(["GITHUB", "JIRA", "CONFLUENCE", "UPLOAD"]);
    });

    it("lets only uploads be deleted and only Confluence be forced to Markdown", () => {
      expect(
        CONNECTOR_LIST.filter((d) => d.knowledgeBase.deletable).map((d) => d.meta.system),
      ).toEqual(["UPLOAD"]);
      expect(
        CONNECTOR_LIST.filter((d) => d.knowledgeBase.markdown).map((d) => d.meta.system),
      ).toEqual(["CONFLUENCE"]);
    });

    it("shows a metadata view for a GitHub organization only", () => {
      const view = CONNECTORS.GITHUB.knowledgeBase.metadataView;
      const artifact = { artifactType: "ORG_METADATA" } as Parameters<
        NonNullable<typeof view>["appliesTo"]
      >[0];

      expect(view?.appliesTo(artifact)).toBe(true);
      expect(view?.appliesTo({ ...artifact, artifactType: "FILE" })).toBe(false);
      expect(CONNECTORS.JIRA.knowledgeBase.metadataView).toBeUndefined();
    });

    it("has exactly one default citation source", () => {
      expect(
        CONNECTOR_LIST.filter((definition) => definition.chat.isDefaultCitationSource),
      ).toHaveLength(1);
    });

    it.each([
      ["https://github.com/acme/api/pull/4", "pr #4", "GITHUB"],
      ["https://git.corp.example/acme/api/blob/main/a.ts", "a.ts", "GITHUB"],
      ["https://acme.atlassian.net/browse/ENG-1", "jira #eng-1", "JIRA"],
      ["https://acme.atlassian.net/rest/x", "board", "JIRA"],
      ["https://acme.atlassian.net/wiki/spaces/ENG/pages/1", "onboarding", "CONFLUENCE"],
      ["https://wiki.corp.example/wiki/spaces/ENG/pages/1", "onboarding", "CONFLUENCE"],
      ["", "handbook.pdf", "UPLOAD"],
    ])("attributes the citation %s (%s) to %s", (url, name, system) => {
      expect(sourceSystemOfCitation(url, name)).toBe(system);
    });
  });
});
