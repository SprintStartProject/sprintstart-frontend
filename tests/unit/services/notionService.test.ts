import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  addNotionCredential,
  changeNotionCredentialName,
  changeNotionCredentialToken,
  deleteNotionCredential,
  getMyNotionCredentials,
  notionService,
  type NotionConnectionDto,
} from "../../../src/services/sources/notionService";

const mockConnection: NotionConnectionDto = {
  id: "conn-123",
  projectId: "proj-1",
  pageId: "page-1",
  pageTitle: "Sprint Planning",
  pageUrl: "https://www.notion.so/Sprint-Planning-page1",
  credentialName: "default",
  sourceEnabled: true,
  autoUpdate: false,
  scheduleSpec: null,
  nextSyncAt: null,
  lastEditedTime: "2026-01-01T00:00:00Z",
  contentHash: null,
  lastSyncedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
};

describe("notion credential endpoints", () => {
  it("getMyNotionCredentials lists the authenticated user's credentials", async () => {
    server.use(
      http.get("/api/v1/notion/credentials", () =>
        HttpResponse.json([
          {
            name: "workspace",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ]),
      ),
    );

    const credentials = await getMyNotionCredentials();

    expect(credentials).toHaveLength(1);
    expect(credentials[0].name).toBe("workspace");
  });

  it("addNotionCredential posts the name and token", async () => {
    expect.assertions(1);

    server.use(
      http.post("/api/v1/notion/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "workspace", token: "secret" });

        return new HttpResponse(null, { status: 201 });
      }),
    );

    await addNotionCredential({ name: "workspace", token: "secret" });
  });

  it("addNotionCredential rejects with an ApiError on 409", async () => {
    server.use(
      http.post("/api/v1/notion/credentials", () =>
        HttpResponse.json({ message: "exists" }, { status: 409 }),
      ),
    );

    await expect(addNotionCredential({ name: "workspace", token: "secret" })).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it("changeNotionCredentialToken puts to /token", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/notion/credentials/token", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "workspace", newToken: "new-secret" });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await changeNotionCredentialToken({ name: "workspace", newToken: "new-secret" });
  });

  it("changeNotionCredentialName puts to /name", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/notion/credentials/name", async ({ request }) => {
        expect(await request.json()).toEqual({ oldName: "workspace", newName: "docs" });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await changeNotionCredentialName({ oldName: "workspace", newName: "docs" });
  });

  it("deleteNotionCredential sends a DELETE with the name in the body", async () => {
    expect.assertions(2);

    server.use(
      http.delete("/api/v1/notion/credentials", async ({ request }) => {
        expect(request.method).toBe("DELETE");
        expect(await request.json()).toEqual({ name: "workspace" });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteNotionCredential({ name: "workspace" });
  });
});

describe("notionService", () => {
  it("discoverPages sends the encoded credential name as query parameter", async () => {
    expect.assertions(2);

    server.use(
      http.get("/api/v1/notion/pages", ({ request }) => {
        expect(new URL(request.url).searchParams.get("credentialName")).toBe("my workspace");

        return HttpResponse.json([
          {
            id: "page-1",
            title: "Sprint Planning",
            url: "https://www.notion.so/Sprint-Planning-page1",
            lastEditedTime: "2026-01-01T00:00:00Z",
          },
        ]);
      }),
    );

    const pages = await notionService.discoverPages("my workspace");

    expect(pages[0].id).toBe("page-1");
  });

  it("createConnection posts the trimmed credential name and the page id", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections", async ({ request }) => {
        expect(await request.json()).toEqual({ credentialName: "default", pageId: "page-1" });

        return HttpResponse.json(mockConnection, { status: 201 });
      }),
    );

    const result = await notionService.createConnection("proj-1", {
      credentialName: " default ",
      pageId: "page-1",
    });

    expect(result).toEqual(mockConnection);
  });

  it("createConnection rejects with an ApiError on 409 for a duplicate page", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections", () =>
        HttpResponse.json({ message: "already connected" }, { status: 409 }),
      ),
    );

    await expect(
      notionService.createConnection("proj-1", { credentialName: "default", pageId: "page-1" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("listConnections calls GET on the project's connections", async () => {
    server.use(
      http.get("/api/v1/notion/projects/proj-1/connections", () =>
        HttpResponse.json([mockConnection]),
      ),
    );

    const result = await notionService.listConnections("proj-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conn-123");
  });

  it("syncConnection posts to /update and returns the outcome", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections/conn-123/update", () =>
        HttpResponse.json({ runId: "run-1", connectionId: "conn-123", outcome: "UPDATED" }),
      ),
    );

    const result = await notionService.syncConnection("proj-1", "conn-123");

    expect(result.outcome).toBe("UPDATED");
  });

  it("syncConnection surfaces a failed outcome with its failure", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections/conn-123/update", () =>
        HttpResponse.json({
          runId: "run-1",
          connectionId: "conn-123",
          outcome: "FAILED",
          failure: { stage: "FETCH", message: "Notion unreachable" },
        }),
      ),
    );

    const result = await notionService.syncConnection("proj-1", "conn-123");

    expect(result.outcome).toBe("FAILED");
    expect(result.failure?.message).toBe("Notion unreachable");
  });

  it("deleteConnection calls DELETE on the connection", async () => {
    expect.assertions(1);

    server.use(
      http.delete("/api/v1/notion/projects/proj-1/connections/conn-123", ({ request }) => {
        expect(request.method).toBe("DELETE");

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await notionService.deleteConnection("proj-1", "conn-123");
  });

  it("configureSchedule puts the schedule and autoUpdate flag", async () => {
    expect.assertions(2);

    server.use(
      http.put(
        "/api/v1/notion/projects/proj-1/connections/conn-123/schedule",
        async ({ request }) => {
          expect(await request.json()).toEqual({
            autoUpdate: true,
            schedule: { type: "INTERVAL", everyMinutes: 60 },
          });

          return HttpResponse.json({
            ...mockConnection,
            autoUpdate: true,
            scheduleSpec: { type: "INTERVAL", everyMinutes: 60 },
          });
        },
      ),
    );

    const result = await notionService.configureSchedule("proj-1", "conn-123", {
      autoUpdate: true,
      schedule: { type: "INTERVAL", everyMinutes: 60 },
    });

    expect(result.scheduleSpec).toEqual({ type: "INTERVAL", everyMinutes: 60 });
  });

  it("encodes project and connection ids in the path", async () => {
    expect.assertions(1);

    server.use(
      http.delete("/api/v1/notion/projects/:projectId/connections/:connectionId", ({ request }) => {
        expect(new URL(request.url).pathname).toBe(
          "/api/v1/notion/projects/proj%2F1/connections/conn%2F2",
        );

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await notionService.deleteConnection("proj/1", "conn/2");
  });
});
