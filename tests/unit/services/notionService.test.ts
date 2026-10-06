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
  type NotionCredentialDto,
  type NotionWorkspaceConnectionDto,
} from "../../../src/services/sources/notionService";

const mockConnection: NotionWorkspaceConnectionDto = {
  id: "conn-123",
  projectId: "proj-1",
  workspaceId: "ws-1",
  workspaceName: "Acme Workspace",
  workspaceUrl: "https://www.notion.so/acme",
  credentialName: "default",
  sourceEnabled: true,
  autoUpdate: false,
  schedule: "every 60 minutes",
  scheduleSpec: { type: "INTERVAL", everyMinutes: 60 },
  nextSyncAt: null,
  lastSyncedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
};

const mockCredential: NotionCredentialDto = {
  name: "workspace",
  workspaceId: "ws-1",
  workspaceName: "Acme Workspace",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("notion credential endpoints", () => {
  it("getMyNotionCredentials lists the authenticated user's credentials", async () => {
    server.use(
      http.get("/api/v1/notion/credentials", () =>
        HttpResponse.json([
          mockCredential,
          { ...mockCredential, name: "old", workspaceId: null, workspaceName: null },
        ]),
      ),
    );

    const credentials = await getMyNotionCredentials();

    expect(credentials).toHaveLength(2);
    expect(credentials[0].workspaceName).toBe("Acme Workspace");
    expect(credentials[1].workspaceName).toBeNull();
  });

  it("addNotionCredential posts the name and token and returns the stored credential", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/notion/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "workspace", token: "secret" });

        return HttpResponse.json(mockCredential, { status: 201 });
      }),
    );

    const result = await addNotionCredential({ name: "workspace", token: "secret" });

    expect(result).toEqual(mockCredential);
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

  it("addNotionCredential rejects with the readable message on 422", async () => {
    server.use(
      http.post("/api/v1/notion/credentials", () =>
        HttpResponse.json(
          {
            message: "Notion rejected the supplied token.",
            code: "NOTION_AUTHENTICATION_FAILED",
          },
          { status: 422 },
        ),
      ),
    );

    await expect(addNotionCredential({ name: "workspace", token: "secret" })).rejects.toMatchObject(
      { status: 422, message: "Notion rejected the supplied token." },
    );
  });

  it("changeNotionCredentialToken puts to /token and returns the updated credential", async () => {
    expect.assertions(2);

    server.use(
      http.put("/api/v1/notion/credentials/token", async ({ request }) => {
        expect(await request.json()).toEqual({ name: "workspace", newToken: "new-secret" });

        return HttpResponse.json(mockCredential);
      }),
    );

    const result = await changeNotionCredentialToken({ name: "workspace", newToken: "new-secret" });

    expect(result.workspaceName).toBe("Acme Workspace");
  });

  it("changeNotionCredentialName puts to /name and returns the renamed credential", async () => {
    expect.assertions(2);

    server.use(
      http.put("/api/v1/notion/credentials/name", async ({ request }) => {
        expect(await request.json()).toEqual({ oldName: "workspace", newName: "docs" });

        return HttpResponse.json({ ...mockCredential, name: "docs" });
      }),
    );

    const result = await changeNotionCredentialName({ oldName: "workspace", newName: "docs" });

    expect(result.name).toBe("docs");
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

  it("createConnection posts only the trimmed credential name", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections", async ({ request }) => {
        expect(await request.json()).toEqual({ credentialName: "default" });

        return HttpResponse.json(mockConnection, { status: 201 });
      }),
    );

    const result = await notionService.createConnection("proj-1", {
      credentialName: " default ",
    });

    expect(result).toEqual(mockConnection);
  });

  it("createConnection rejects with an ApiError on 409 for an already connected workspace", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections", () =>
        HttpResponse.json({ message: "already connected" }, { status: 409 }),
      ),
    );

    await expect(
      notionService.createConnection("proj-1", { credentialName: "default" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("createConnection rejects with an ApiError on 422 when Notion rejects the stored token", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections", () =>
        HttpResponse.json({ message: "token rejected" }, { status: 422 }),
      ),
    );

    await expect(
      notionService.createConnection("proj-1", { credentialName: "default" }),
    ).rejects.toMatchObject({ status: 422 });
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

  it("syncConnection posts to /update and returns the per-page counts", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections/conn-123/update", () =>
        HttpResponse.json({
          runId: "run-1",
          connectionId: "conn-123",
          outcome: "PARTIAL",
          successfulPages: 12,
          failedPages: 2,
          removedPages: 1,
        }),
      ),
    );

    const result = await notionService.syncConnection("proj-1", "conn-123");

    expect(result).toMatchObject({
      outcome: "PARTIAL",
      successfulPages: 12,
      failedPages: 2,
      removedPages: 1,
    });
    expect(result.failure).toBeUndefined();
  });

  it("syncConnection surfaces a failure when the whole run fails", async () => {
    server.use(
      http.post("/api/v1/notion/projects/proj-1/connections/conn-123/update", () =>
        HttpResponse.json({
          runId: "run-1",
          connectionId: "conn-123",
          outcome: "FAILED",
          successfulPages: 0,
          failedPages: 0,
          removedPages: 0,
          failure: { stage: "FETCHING", message: "Notion unreachable" },
        }),
      ),
    );

    const result = await notionService.syncConnection("proj-1", "conn-123");

    expect(result.failure).toEqual({ stage: "FETCHING", message: "Notion unreachable" });
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
