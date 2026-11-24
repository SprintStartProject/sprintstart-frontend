import { describe, expect, it } from "vitest";
import {
  DEFAULT_RUN_FILTER,
  RUN_PAGE_SIZE,
  buildRunQuery,
  getSyncSettingsCopy,
  hasSourceId,
  isRunFilterActive,
  nextSelectedSourceId,
  resolveRequestedSourceId,
  runSourceOptionsOf,
  sourceHealthOf,
} from "../../../../src/pages/dataIngestion/ingestionRules";
import type { DataSource } from "../../../../src/features/data-ingestion/types";

function source(
  sourceId: string,
  sourceSystem: DataSource["sourceSystem"],
  state: string,
  details: unknown = { system: sourceSystem },
): DataSource {
  return {
    sourceId,
    sourceSystem,
    name: `Name of ${sourceId}`,
    statusView: { state },
    details,
  } as unknown as DataSource;
}

const github = source("src-1", "GITHUB", "connected", {
  system: "GITHUB",
  repository: { fullName: "Octo/Hello", repositoryId: "repo-uuid" },
});
const jira = source("https://team.atlassian.net", "JIRA", "syncing");
const noRepo = source("src-3", "GITHUB", "attention", { system: "GITHUB", repository: null });
const all = [github, jira, noRepo];

describe("getSyncSettingsCopy", () => {
  it("names a connector's sources in the singular and the plural", () => {
    expect(getSyncSettingsCopy("JIRA")).toMatchObject({
      label: "Jira",
      one: "Jira instance",
      many: "Jira instances",
    });
    expect(typeof getSyncSettingsCopy("GITHUB").skipsWhenAutoUpdateOff).toBe("boolean");
  });
});

describe("hasSourceId", () => {
  it("finds a source by its card id", () => {
    expect(hasSourceId(all, "src-1")).toBe(true);
    expect(hasSourceId(all, "nope")).toBe(false);
    expect(hasSourceId([], "src-1")).toBe(false);
  });
});

describe("resolveRequestedSourceId", () => {
  it("is none for nothing asked for", () => {
    expect(resolveRequestedSourceId(all, "")).toBeNull();
  });

  it("takes a card id as it is", () => {
    expect(resolveRequestedSourceId(all, "src-3")).toBe("src-3");
  });

  it("takes the component spelling of a GitHub repository, whatever its case", () => {
    expect(resolveRequestedSourceId(all, "octo/hello")).toBe("src-1");
    expect(resolveRequestedSourceId(all, "OCTO/HELLO")).toBe("src-1");
  });

  it("is none for something that is not connected", () => {
    expect(resolveRequestedSourceId(all, "other/repo")).toBeNull();
    expect(resolveRequestedSourceId([], "octo/hello")).toBeNull();
  });
});

describe("nextSelectedSourceId", () => {
  it("lets a requested source win", () => {
    expect(nextSelectedSourceId("src-3", all, "src-1")).toBe("src-1");
  });

  it("keeps the selection while it is still in the list", () => {
    expect(nextSelectedSourceId("src-3", all, null)).toBe("src-3");
  });

  it("keeps the selection while the list is transiently empty", () => {
    expect(nextSelectedSourceId("src-3", [], null)).toBe("src-3");
  });

  it("drops a selection that is genuinely gone", () => {
    expect(nextSelectedSourceId("gone", all, null)).toBeNull();
  });

  it("stays empty without a selection", () => {
    expect(nextSelectedSourceId(null, all, null)).toBeNull();
    expect(nextSelectedSourceId(null, [], null)).toBeNull();
  });
});

describe("buildRunQuery", () => {
  it("scopes to the project and the page, with no filter by default", () => {
    expect(buildRunQuery(DEFAULT_RUN_FILTER, 3, "p1")).toEqual({
      page: 3,
      size: RUN_PAGE_SIZE,
      projectId: "p1",
      repositoryId: undefined,
      sourceRef: undefined,
      status: undefined,
    });
  });

  it("leaves the project out when none is selected", () => {
    expect(buildRunQuery(DEFAULT_RUN_FILTER, 1, "").projectId).toBeUndefined();
  });

  it("filters by status", () => {
    expect(buildRunQuery({ ...DEFAULT_RUN_FILTER, status: "FAILED" }, 1, "p1").status).toBe(
      "FAILED",
    );
  });

  it("filters a GitHub source by repository id and a Jira source by source reference", () => {
    const byRepo = buildRunQuery(
      { status: "ALL", sourceValue: "repo-uuid", sourceSystem: "GITHUB" },
      1,
      "p1",
    );
    expect([byRepo.repositoryId, byRepo.sourceRef]).toEqual(["repo-uuid", undefined]);

    const byRef = buildRunQuery(
      { status: "ALL", sourceValue: "https://x", sourceSystem: "JIRA" },
      1,
      "p1",
    );
    expect([byRef.repositoryId, byRef.sourceRef]).toEqual([undefined, "https://x"]);
  });

  it("does not scope by a source value without a system, or with ALL", () => {
    const noSystem = buildRunQuery(
      { status: "ALL", sourceValue: "repo-uuid", sourceSystem: null },
      1,
      "p1",
    );
    expect([noSystem.repositoryId, noSystem.sourceRef]).toEqual([undefined, undefined]);

    const allSources = buildRunQuery(
      { status: "ALL", sourceValue: "ALL", sourceSystem: "GITHUB" },
      1,
      "p1",
    );
    expect([allSources.repositoryId, allSources.sourceRef]).toEqual([undefined, undefined]);
  });
});

describe("runSourceOptionsOf", () => {
  it("offers the sources whose connector can tell their runs apart", () => {
    expect(runSourceOptionsOf(all)).toEqual([
      { value: "repo-uuid", label: "Name of src-1", sourceSystem: "GITHUB" },
      {
        value: "https://team.atlassian.net",
        label: "Name of https://team.atlassian.net",
        sourceSystem: "JIRA",
      },
    ]);
  });
});

describe("isRunFilterActive", () => {
  it("is on for a status or a source, off by default", () => {
    expect(isRunFilterActive(DEFAULT_RUN_FILTER)).toBe(false);
    expect(isRunFilterActive({ ...DEFAULT_RUN_FILTER, status: "FAILED" })).toBe(true);
    expect(isRunFilterActive({ ...DEFAULT_RUN_FILTER, sourceValue: "x" })).toBe(true);
  });
});

describe("sourceHealthOf", () => {
  it("counts the sources in each state", () => {
    const sources = [...all, source("d", "GITHUB", "disabled"), source("c", "GITHUB", "connected")];
    expect(sourceHealthOf(sources)).toEqual({
      total: 5,
      connected: 2,
      syncing: 1,
      attention: 1,
      disabled: 1,
    });
    expect(sourceHealthOf([])).toEqual({
      total: 0,
      connected: 0,
      syncing: 0,
      attention: 0,
      disabled: 0,
    });
  });
});
