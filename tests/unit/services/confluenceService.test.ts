import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  confluenceService,
  type ConfluenceConnectionDto,
  type ConfluenceIngestionResult,
} from "../../../src/services/sources/confluenceService";

const mockConnection: ConfluenceConnectionDto = {
  id: "conn-123",
  projectId: "proj-1",
  baseUrl: "https://example.atlassian.net/wiki",
  spaceId: "SPACE-1",
  spaceKey: "SP",
  pageAllowlist: [],
  pageDenylist: [],
  credentialsConfigured: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
  sourceEnabled: true,
};

describe("confluenceService", () => {
  it("createConnection sends POST with correct payload", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/confluence/projects/proj-1/connections", async ({ request }) => {
        const body = await request.json();
        expect(body).toEqual({
          baseUrl: "https://example.atlassian.net/wiki",
          spaceId: "SPACE-1",
          email: "user@example.com",
          apiToken: "secret-token",
          pageAllowlist: [],
          pageDenylist: [],
        });

        return HttpResponse.json(mockConnection);
      }),
    );

    const result = await confluenceService.createConnection("proj-1", {
      baseUrl: "https://example.atlassian.net/wiki",
      spaceId: "SPACE-1",
      email: "user@example.com",
      apiToken: "secret-token",
    });

    expect(result).toEqual(mockConnection);
  });

  it("listConnections calls GET /api/v1/confluence/projects/:projectId/connections", async () => {
    expect.assertions(2);

    server.use(
      http.get("/api/v1/confluence/projects/proj-1/connections", () => {
        return HttpResponse.json([mockConnection]);
      }),
    );

    const result = await confluenceService.listConnections("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conn-123");
  });

  it("getConnection calls GET /api/v1/confluence/projects/:projectId/connections/:connectionId", async () => {
    expect.assertions(2);

    server.use(
      http.get("/api/v1/confluence/projects/proj-1/connections/conn-123", () => {
        return HttpResponse.json(mockConnection);
      }),
    );

    const result = await confluenceService.getConnection("proj-1", "conn-123");
    expect(result.id).toBe("conn-123");
    expect(result.spaceId).toBe("SPACE-1");
  });

  it("syncConnection calls POST /api/v1/confluence/projects/:projectId/connections/:connectionId/update", async () => {
    expect.assertions(2);

    const mockResult: ConfluenceIngestionResult = {
      runId: "run-1",
      connectionId: "conn-123",
      discovered: 10,
      eligible: 10,
      filtered: 0,
      created: 10,
      updated: 0,
      unchanged: 0,
      failed: 0,
      failures: [],
      status: "COMPLETED",
    };

    server.use(
      http.post("/api/v1/confluence/projects/proj-1/connections/conn-123/update", () => {
        return HttpResponse.json(mockResult);
      }),
    );

    const result = await confluenceService.syncConnection("proj-1", "conn-123");
    expect(result.status).toBe("COMPLETED");
    expect(result.created).toBe(10);
  });
});
