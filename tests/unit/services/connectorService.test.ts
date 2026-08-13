import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import { connectorService } from "../../../src/services/connectorService";

describe("connectorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listConnectors returns backend connectors", async () => {
    server.use(
      http.get("/api/v1/connectors", () =>
        HttpResponse.json([
          {
            id: "github",
            name: "Github Repository Connector",
            enabled: true,
            firstConfiguredAt: "2024-01-01T00:00:00Z",
            lastConfiguredAt: "2024-01-02T00:00:00Z",
          },
        ]),
      ),
    );

    const connectors = await connectorService.listConnectors();

    expect(connectors).toHaveLength(1);
    expect(connectors[0].id).toBe("github");
    expect(connectors[0].enabled).toBe(true);
  });

  it("setConnectorEnabled patches the connector and returns the updated state", async () => {
    server.use(
      http.patch("/api/v1/connectors/github", async ({ request }) => {
        const body = (await request.json()) as { enabled: boolean };
        return HttpResponse.json({
          id: "github",
          enabled: body.enabled,
          firstConfiguredAt: "2024-01-01T00:00:00Z",
          lastConfiguredAt: "2024-01-03T00:00:00Z",
        });
      }),
    );

    const result = await connectorService.setConnectorEnabled("github", false);

    expect(result.enabled).toBe(false);
    expect(result.id).toBe("github");
  });

  it("setConnectorEnabled rejects with an ApiError on 403", async () => {
    server.use(
      http.patch("/api/v1/connectors/github", () => HttpResponse.text("", { status: 403 })),
    );

    await expect(connectorService.setConnectorEnabled("github", true)).rejects.toThrow();
  });

  it("getConnectorSources returns the sources of a connector", async () => {
    server.use(
      http.get("/api/v1/connectors/github/sources", () =>
        HttpResponse.json({
          connectorId: "github",
          sources: [
            {
              id: "org/repo",
              name: "org/repo",
              url: "https://github.com/org/repo",
              enabled: true,
            },
          ],
        }),
      ),
    );

    const response = await connectorService.getConnectorSources("github");

    expect(response.connectorId).toBe("github");
    expect(response.sources).toHaveLength(1);
    expect(response.sources[0].enabled).toBe(true);
  });

  it("patchConnectorSources sends a batched update and returns patched sources", async () => {
    server.use(
      http.patch("/api/v1/connectors/github/sources/status", async ({ request }) => {
        const body = (await request.json()) as {
          sources: { sourceId: string; enabled: boolean }[];
        };

        return HttpResponse.json({
          connectorId: "github",
          sources: body.sources.map((source) => ({
            id: source.sourceId,
            name: source.sourceId,
            url: `https://github.com/${source.sourceId}`,
            enabled: source.enabled,
          })),
        });
      }),
    );

    const response = await connectorService.patchConnectorSources("github", [
      { sourceId: "org/repo", enabled: false },
    ]);

    expect(response.sources[0].enabled).toBe(false);
  });

  it("patchConnectorSources rejects with an ApiError on 400", async () => {
    server.use(
      http.patch("/api/v1/connectors/github/sources/status", () =>
        HttpResponse.json({ message: "sources must not be empty" }, { status: 400 }),
      ),
    );

    await expect(connectorService.patchConnectorSources("github", [])).rejects.toThrow();
  });
});
