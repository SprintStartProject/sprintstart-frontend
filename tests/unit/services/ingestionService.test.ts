import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import {
  getIngestionRun,
  getIngestionRunsPage,
  getIngestionSourceStatuses,
} from "../../../src/services/ingestionService";
import { server } from "../../unit/setup/vitest.setup";

describe("ingestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getIngestionRun", () => {
    it("fetches and maps a single run by id", async () => {
      server.use(
        http.get("/api/v1/ingestion-runs/run-42", () =>
          HttpResponse.json({
            runId: "run-42",
            sourceSystem: "GITHUB",
            sourceId: "octo/repo",
            owner: "octo",
            name: "repo",
            repositoryId: "repo-uuid",
            startedAt: "2026-07-01T00:00:00Z",
            finishedAt: "2026-07-01T01:00:00Z",
            ingestedCount: 7,
            deletedCount: 2,
            status: "COMPLETED",
          }),
        ),
      );

      const run = await getIngestionRun("run-42");
      expect(run.runId).toBe("run-42");
      expect(run.repositoryId).toBe("repo-uuid");
      expect(run.deletedCount).toBe(2);
    });

    it("encodes the run id in the request path", async () => {
      let capturedPath: string | null = null;
      server.use(
        http.get("/api/v1/ingestion-runs/:runId", ({ request }) => {
          capturedPath = new URL(request.url).pathname;
          return HttpResponse.json({
            runId: "a b",
            sourceSystem: "GITHUB",
            startedAt: "2026-07-01T00:00:00Z",
            finishedAt: null,
            status: "RUNNING",
          });
        }),
      );

      await getIngestionRun("a b");
      expect(capturedPath).toBe("/api/v1/ingestion-runs/a%20b");
    });
  });

  describe("getIngestionRunsPage", () => {
    it("sends the filters and maps the page envelope", async () => {
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get("/api/v1/ingestion-runs/page", ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            items: [
              {
                runId: "p1",
                sourceSystem: "GITHUB",
                startedAt: "2026-07-01T00:00:00Z",
                finishedAt: "2026-07-01T01:00:00Z",
                status: "COMPLETED",
              },
            ],
            page: {
              number: 2,
              size: 20,
              totalElements: 25,
              totalPages: 2,
              hasNext: false,
              hasPrevious: true,
            },
          });
        }),
      );

      const result = await getIngestionRunsPage({
        page: 2,
        size: 20,
        repositoryId: "repo-uuid",
        status: "COMPLETED",
        since: "2026-06-01T00:00:00Z",
      });

      expect(capturedParams!.get("page")).toBe("2");
      expect(capturedParams!.get("size")).toBe("20");
      expect(capturedParams!.get("repositoryId")).toBe("repo-uuid");
      expect(capturedParams!.get("status")).toBe("COMPLETED");
      expect(capturedParams!.get("since")).toBe("2026-06-01T00:00:00Z");
      expect(result.items).toHaveLength(1);
      expect(result.page.totalElements).toBe(25);
      expect(result.page.hasNext).toBe(false);
    });

    it("clamps size to 1..100 and derives missing page metadata", async () => {
      let capturedSize: string | null = null;
      server.use(
        http.get("/api/v1/ingestion-runs/page", ({ request }) => {
          capturedSize = new URL(request.url).searchParams.get("size");
          return HttpResponse.json({
            items: [
              {
                runId: "p1",
                sourceSystem: "GITHUB",
                startedAt: "2026-07-01T00:00:00Z",
                finishedAt: "2026-07-01T01:00:00Z",
                status: "COMPLETED",
              },
            ],
          });
        }),
      );

      const result = await getIngestionRunsPage({ size: 500 });
      expect(capturedSize).toBe("100");
      expect(result.page.number).toBe(1);
      expect(result.page.hasNext).toBe(false);
      expect(result.page.totalElements).toBe(1);
    });

    it("passes the sourceRef filter for a connector-neutral instance", async () => {
      let capturedParams: URLSearchParams | null = null;
      server.use(
        http.get("/api/v1/ingestion-runs/page", ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({ items: [] });
        }),
      );

      await getIngestionRunsPage({
        sourceRef: "https://team.atlassian.net",
      });

      expect(capturedParams!.get("sourceRef")).toBe("https://team.atlassian.net");
      expect(capturedParams!.get("repositoryId")).toBeNull();
    });
  });

  describe("getIngestionSourceStatuses", () => {
    it("maps per-repo statuses and defaults optional fields", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([
            {
              sourceSystem: "GITHUB",
              sourceId: "octo/repo",
              repositoryId: "repo-uuid",
              owner: "octo",
              name: "repo",
              sourceUrl: "https://github.com/octo/repo",
              connectionStatus: "CONNECTED",
              enabled: true,
              lastRunTime: "2026-07-01T00:00:00Z",
              ingestedCount: 12,
              artifactCount: 340,
              lastCommitsSyncAt: "2026-07-01T00:00:00Z",
            },
          ]),
        ),
      );

      const statuses = await getIngestionSourceStatuses();
      expect(statuses[0].repositoryId).toBe("repo-uuid");
      expect(statuses[0].artifactCount).toBe(340);
      expect(statuses[0].connectionStatus).toBe("CONNECTED");
      expect(statuses[0].enabled).toBe(true);
      expect(statuses[0].deletedCount).toBe(0);
      expect(statuses[0].lastIssuesSyncAt).toBeNull();
      // No displayName in the fixture -> falls back to the sourceId.
      expect(statuses[0].displayName).toBe("octo/repo");
    });

    it("maps a connector-neutral (Jira) row with nullable GitHub identity", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([
            {
              sourceSystem: "JIRA",
              sourceId: "https://team.atlassian.net",
              displayName: "Team board",
              repositoryId: null,
              owner: null,
              name: null,
              sourceUrl: "https://team.atlassian.net",
              connectionStatus: "CONNECTED",
              enabled: true,
              artifactCount: 128,
              lastIssuesSyncAt: "2026-07-01T00:00:00Z",
            },
          ]),
        ),
      );

      const statuses = await getIngestionSourceStatuses();
      expect(statuses[0].sourceSystem).toBe("JIRA");
      expect(statuses[0].sourceId).toBe("https://team.atlassian.net");
      expect(statuses[0].displayName).toBe("Team board");
      expect(statuses[0].repositoryId).toBeNull();
      expect(statuses[0].owner).toBeNull();
      expect(statuses[0].name).toBeNull();
      expect(statuses[0].artifactCount).toBe(128);
    });

    it("passes the projectId query when provided", async () => {
      let capturedProjectId: string | null = null;
      server.use(
        http.get("/api/v1/ingestion-sources/status", ({ request }) => {
          capturedProjectId = new URL(request.url).searchParams.get("projectId");
          return HttpResponse.json([]);
        }),
      );

      await getIngestionSourceStatuses("project-1");
      expect(capturedProjectId).toBe("project-1");
    });

    it("normalizes an unknown connection status to CONNECTED", async () => {
      server.use(
        http.get("/api/v1/ingestion-sources/status", () =>
          HttpResponse.json([
            {
              sourceId: "octo/repo",
              repositoryId: "repo-uuid",
              owner: "octo",
              name: "repo",
              sourceUrl: "https://github.com/octo/repo",
              connectionStatus: "SOMETHING_NEW",
            },
          ]),
        ),
      );

      const statuses = await getIngestionSourceStatuses();
      expect(statuses[0].connectionStatus).toBe("CONNECTED");
      expect(statuses[0].enabled).toBe(true);
    });
  });
});
