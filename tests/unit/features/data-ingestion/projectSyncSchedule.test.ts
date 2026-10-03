import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadProjectSyncSchedule,
  saveProjectSyncSchedule,
} from "../../../../src/features/data-ingestion/projectSyncSchedule";
import { DEFAULT_SYNC_SCHEDULE } from "../../../../src/services/sources/syncSchedule";
import type { DataSource } from "../../../../src/features/data-ingestion/types";

const mocks = vi.hoisted(() => ({
  getGithubRepositoryConfig: vi.fn(),
  configureGithubRepository: vi.fn(),
  getJiraConfig: vi.fn(),
  configureJiraInstance: vi.fn(),
  getConnection: vi.fn(),
  configureSchedule: vi.fn(),
}));

vi.mock("../../../../src/services/sources/githubService", () => ({
  getGithubRepositoryConfig: mocks.getGithubRepositoryConfig,
  configureGithubRepository: mocks.configureGithubRepository,
}));

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getJiraConfig: mocks.getJiraConfig,
  configureJiraInstance: mocks.configureJiraInstance,
}));

vi.mock("../../../../src/services/sources/confluenceService", () => ({
  confluenceService: {
    getConnection: mocks.getConnection,
    configureSchedule: mocks.configureSchedule,
  },
}));

function githubSource(name: string): DataSource {
  return {
    sourceSystem: "GITHUB",
    details: {
      system: "GITHUB",
      repository: {
        owner: "acme",
        name,
        repositoryId: `id-${name}`,
        fullName: `acme/${name}`,
        url: `https://github.com/acme/${name}`,
        enabled: true,
      },
      syncTimes: { commits: null, issues: null, pullRequests: null },
    },
  } as DataSource;
}

function jiraSource(instanceUrl: string): DataSource {
  return {
    sourceSystem: "JIRA",
    details: {
      system: "JIRA",
      instance: { instanceUrl, displayName: "Board", credentialName: "", credentialUserEmail: "" },
      syncTimes: { issues: null },
    },
  } as DataSource;
}

function confluenceSource(connectionId: string): DataSource {
  return {
    sourceSystem: "CONFLUENCE",
    details: {
      system: "CONFLUENCE",
      space: {
        connectionId,
        baseUrl: "https://acme.atlassian.net",
        spaceId: "1",
        spaceKey: "E",
      },
    },
  } as DataSource;
}

const every = (everyMinutes: number) => ({ type: "INTERVAL", everyMinutes }) as const;

describe("loadProjectSyncSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the schedule every source of the connector shares", async () => {
    mocks.getGithubRepositoryConfig.mockResolvedValue({ autoUpdate: false, spec: every(15) });

    const result = await loadProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two")],
      "p1",
    );

    expect(result).toEqual({ config: { autoUpdate: false, schedule: every(15) }, isMixed: false });
  });

  it("returns the default and flags the result when the sources differ", async () => {
    mocks.getGithubRepositoryConfig
      .mockResolvedValueOnce({ autoUpdate: true, spec: every(15) })
      .mockResolvedValueOnce({ autoUpdate: true, spec: every(30) });

    const result = await loadProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two")],
      "p1",
    );

    expect(result).toEqual({ config: DEFAULT_SYNC_SCHEDULE, isMixed: true });
  });

  it("treats a differing auto-update flag as a difference", async () => {
    mocks.getGithubRepositoryConfig
      .mockResolvedValueOnce({ autoUpdate: true, spec: every(15) })
      .mockResolvedValueOnce({ autoUpdate: false, spec: every(15) });

    const result = await loadProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two")],
      "p1",
    );

    expect(result.isMixed).toBe(true);
  });

  it("compares times and weekdays regardless of format and order", async () => {
    mocks.getGithubRepositoryConfig
      .mockResolvedValueOnce({
        autoUpdate: true,
        spec: { type: "WEEKLY", time: "02:00", daysOfWeek: ["MONDAY", "FRIDAY"] },
      })
      .mockResolvedValueOnce({
        autoUpdate: true,
        spec: { type: "WEEKLY", time: "02:00:00", daysOfWeek: ["FRIDAY", "MONDAY"] },
      });

    const result = await loadProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two")],
      "p1",
    );

    expect(result.isMixed).toBe(false);
  });

  it("flags the result when one source's schedule cannot be read", async () => {
    mocks.getGithubRepositoryConfig
      .mockResolvedValueOnce({ autoUpdate: true, spec: every(15) })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await loadProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two")],
      "p1",
    );

    expect(result).toEqual({ config: DEFAULT_SYNC_SCHEDULE, isMixed: true });
  });

  it("shows the default without a hint when no source has a schedule yet", async () => {
    mocks.getGithubRepositoryConfig.mockResolvedValue({ autoUpdate: true, spec: null });

    const result = await loadProjectSyncSchedule("GITHUB", [githubSource("one")], "p1");

    expect(result).toEqual({ config: DEFAULT_SYNC_SCHEDULE, isMixed: false });
  });

  it("reads Jira instances by URL and Confluence connections through the project", async () => {
    mocks.getJiraConfig.mockResolvedValue({ autoUpdate: true, spec: every(10) });
    mocks.getConnection.mockResolvedValue({ autoUpdate: undefined, spec: every(20) });

    const jira = await loadProjectSyncSchedule(
      "JIRA",
      [jiraSource("https://a.atlassian.net")],
      "p1",
    );
    const confluence = await loadProjectSyncSchedule("CONFLUENCE", [confluenceSource("c1")], "p1");

    expect(mocks.getJiraConfig).toHaveBeenCalledWith("https://a.atlassian.net");
    expect(jira.config.schedule).toEqual(every(10));
    expect(mocks.getConnection).toHaveBeenCalledWith("p1", "c1");
    expect(confluence.config).toEqual({ autoUpdate: false, schedule: every(20) });
  });

  it("ignores sources of other connectors", async () => {
    mocks.getJiraConfig.mockResolvedValue({ autoUpdate: true, spec: every(10) });

    await loadProjectSyncSchedule("JIRA", [githubSource("one"), jiraSource("https://a")], "p1");

    expect(mocks.getGithubRepositoryConfig).not.toHaveBeenCalled();
  });
});

describe("saveProjectSyncSchedule", () => {
  const request = { autoUpdate: true, schedule: every(30) };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configureGithubRepository.mockResolvedValue(undefined);
    mocks.configureJiraInstance.mockResolvedValue(undefined);
    mocks.configureSchedule.mockResolvedValue({});
  });

  it("writes the schedule to every source of the connector", async () => {
    await saveProjectSyncSchedule(
      "GITHUB",
      [githubSource("one"), githubSource("two"), jiraSource("https://a")],
      "p1",
      request,
      "GitHub repositories",
    );

    expect(mocks.configureGithubRepository).toHaveBeenCalledTimes(2);
    expect(mocks.configureGithubRepository).toHaveBeenCalledWith(
      expect.objectContaining({ name: "one" }),
      request,
    );
    expect(mocks.configureJiraInstance).not.toHaveBeenCalled();
  });

  it("sends the Jira instance URL together with the schedule", async () => {
    await saveProjectSyncSchedule(
      "JIRA",
      [jiraSource("https://a.atlassian.net")],
      "p1",
      request,
      "Jira instances",
    );

    expect(mocks.configureJiraInstance).toHaveBeenCalledWith({
      instanceUrl: "https://a.atlassian.net",
      ...request,
    });
  });

  it("attempts every source and reports how many failed", async () => {
    mocks.configureGithubRepository
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    await expect(
      saveProjectSyncSchedule(
        "GITHUB",
        [githubSource("one"), githubSource("two")],
        "p1",
        request,
        "GitHub repositories",
      ),
    ).rejects.toThrow("Couldn't apply the schedule to 1 of 2 GitHub repositories.");
    expect(mocks.configureGithubRepository).toHaveBeenCalledTimes(2);
  });

  it("applies a Confluence schedule per connection of the project", async () => {
    await saveProjectSyncSchedule(
      "CONFLUENCE",
      [confluenceSource("c1"), confluenceSource("c2")],
      "p1",
      request,
      "Confluence spaces",
    );

    expect(mocks.configureSchedule).toHaveBeenCalledWith("p1", "c1", {
      schedule: request.schedule,
      autoUpdate: true,
    });
    expect(mocks.configureSchedule).toHaveBeenCalledWith("p1", "c2", {
      schedule: request.schedule,
      autoUpdate: true,
    });
  });
});
