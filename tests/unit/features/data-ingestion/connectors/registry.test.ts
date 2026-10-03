import { describe, expect, it } from "vitest";
import {
  CHAT_SOURCE_SYSTEMS,
  CONNECTORS,
  CONNECTOR_LIST,
  SCHEDULED_SOURCE_SYSTEMS,
  findConnectorById,
  getConnector,
} from "../../../../../src/features/data-ingestion/connectors/registry";
import {
  SOURCE_SYSTEMS,
  toSourceSystem,
} from "../../../../../src/features/data-ingestion/connectors/sourceSystems";
import { SOURCE_META } from "../../../../../src/features/data-ingestion/data";
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
});
