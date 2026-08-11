import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  addJiraCredential,
  changeJiraCredentialName,
  changeJiraCredentialToken,
  configureAllJiraInstances,
  configureJiraInstance,
  connectJiraInstance,
  deleteJiraCredential,
  getAllJiraConfigs,
  getJiraConfig,
  getMyJiraCredentials,
  getJiraInstances,
  removeJiraInstanceFromProject,
  updateAllJiraInstances,
  updateJiraInstance,
} from "../../../src/services/sources/jiraService";

describe("jiraService instance endpoints", () => {
  it("getJiraInstances lists instances without a query when no project is given", async () => {
    expect.assertions(2);

    server.use(
      http.get("/api/v1/jira/instances", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.has("projectId")).toBe(false);

        return HttpResponse.json([
          {
            instanceUrl: "https://acme.atlassian.net",
            displayName: "Acme",
            lastUpdate: "2026-01-01T00:00:00Z",
            projectIds: ["project-1"],
            sourceEnabled: true,
            status: "UP_TO_DATE",
            updateCredentialName: "token-a",
            updateCredentialUserEmail: "pm@example.com",
          },
        ]);
      }),
    );

    const instances = await getJiraInstances();

    expect(instances).toHaveLength(1);
  });

  it("getJiraInstances forwards the optional projectId query", async () => {
    expect.assertions(1);

    server.use(
      http.get("/api/v1/jira/instances", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("projectId")).toBe("project-42");

        return HttpResponse.json([]);
      }),
    );

    await getJiraInstances("project-42");
  });

  it("connectJiraInstance posts the request and resolves on an empty 202 body", async () => {
    expect.assertions(2);

    const request = {
      displayName: "Acme",
      url: "https://acme.atlassian.net",
      userEmail: "pm@example.com",
      tokenName: "token-a",
      projectId: "project-1",
    };

    server.use(
      http.post("/api/v1/jira/connect", async ({ request: req }) => {
        expect(await req.json()).toEqual(request);

        return new HttpResponse(null, { status: 202 });
      }),
    );

    const result = await connectJiraInstance(request);

    expect(result).toBeUndefined();
  });

  it("connectJiraInstance rejects with an ApiError on 502", async () => {
    server.use(
      http.post("/api/v1/jira/connect", () =>
        HttpResponse.json({ message: "Jira server unreachable" }, { status: 502 }),
      ),
    );

    await expect(
      connectJiraInstance({
        displayName: "Acme",
        url: "https://acme.atlassian.net",
        userEmail: "pm@example.com",
        tokenName: "token-a",
        projectId: "project-1",
      }),
    ).rejects.toThrow();
  });

  it("updateJiraInstance posts the instance url and returns the transaction id", async () => {
    server.use(
      http.post("/api/v1/jira/update", async ({ request }) => {
        expect(await request.json()).toEqual({
          instanceUrl: "https://acme.atlassian.net",
        });

        return HttpResponse.json({ transactionId: "tx-1" });
      }),
    );

    const response = await updateJiraInstance({
      instanceUrl: "https://acme.atlassian.net",
    });

    expect(response.transactionId).toBe("tx-1");
  });

  it("updateAllJiraInstances returns one transaction id per instance", async () => {
    server.use(
      http.post("/api/v1/jira/update-all", () =>
        HttpResponse.json([{ transactionId: "tx-1" }, { transactionId: "tx-2" }]),
      ),
    );

    const responses = await updateAllJiraInstances();

    expect(responses).toHaveLength(2);
    expect(responses.map((r) => r.transactionId)).toEqual(["tx-1", "tx-2"]);
  });
});

describe("jiraService credential endpoints", () => {
  it("addJiraCredential posts the credential payload", async () => {
    expect.assertions(1);

    server.use(
      http.post("/api/v1/jira/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
          authToken: "secret",
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await addJiraCredential({
      userEmail: "pm@example.com",
      tokenName: "token-a",
      authToken: "secret",
    });
  });

  it("getMyJiraCredentials lists the authenticated user's credentials", async () => {
    server.use(
      http.get("/api/v1/jira/credentials", () =>
        HttpResponse.json([{ userEmail: "pm+user@example.com", displayName: "token-a" }]),
      ),
    );

    const credentials = await getMyJiraCredentials();

    expect(credentials).toHaveLength(1);
    expect(credentials[0]).toEqual({
      userEmail: "pm+user@example.com",
      displayName: "token-a",
    });
  });
  it("deleteJiraCredential sends a DELETE with the credential identity", async () => {
    expect.assertions(1);

    server.use(
      http.delete("/api/v1/jira/credentials", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteJiraCredential({
      userEmail: "pm@example.com",
      tokenName: "token-a",
    });
  });

  it("deleteJiraCredential rejects with an ApiError on 404", async () => {
    server.use(
      http.delete("/api/v1/jira/credentials", () =>
        HttpResponse.json({ message: "unknown credential" }, { status: 404 }),
      ),
    );

    await expect(
      deleteJiraCredential({ userEmail: "pm@example.com", tokenName: "gone" }),
    ).rejects.toThrow();
  });

  it("changeJiraCredentialName patches the name and returns the credential", async () => {
    server.use(
      http.patch("/api/v1/jira/credentials/patch/name", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          oldName: "token-a",
          newName: "token-b",
        });

        return HttpResponse.json({
          userEmail: "pm@example.com",
          displayName: "token-b",
        });
      }),
    );

    const credential = await changeJiraCredentialName({
      userEmail: "pm@example.com",
      oldName: "token-a",
      newName: "token-b",
    });

    expect(credential.displayName).toBe("token-b");
  });

  it("changeJiraCredentialToken patches the token secret", async () => {
    server.use(
      http.patch("/api/v1/jira/credentials/patch/token", async ({ request }) => {
        expect(await request.json()).toEqual({
          userEmail: "pm@example.com",
          tokenName: "token-a",
          newToken: "new-secret",
        });

        return HttpResponse.json({
          userEmail: "pm@example.com",
          displayName: "token-a",
        });
      }),
    );

    const credential = await changeJiraCredentialToken({
      userEmail: "pm@example.com",
      tokenName: "token-a",
      newToken: "new-secret",
    });

    expect(credential.displayName).toBe("token-a");
  });
});

describe("jiraService config endpoints", () => {
  it("getAllJiraConfigs lists every instance config", async () => {
    server.use(
      http.get("/api/v1/jira/config", () =>
        HttpResponse.json([
          {
            instanceUrl: "https://acme.atlassian.net",
            autoUpdate: true,
            spec: { type: "DAILY", time: "02:00" },
            schedule: "0 0 2 * * *",
            nextSyncAt: "2026-01-02T02:00:00Z",
          },
        ]),
      ),
    );

    const configs = await getAllJiraConfigs();

    expect(configs).toHaveLength(1);
    expect(configs[0].autoUpdate).toBe(true);
  });

  it("removeJiraInstanceFromProject sends a DELETE with query params", async () => {
    let capturedUrl: URL | null = null;

    server.use(
      http.delete("/api/v1/jira/instances/project", ({ request }) => {
        capturedUrl = new URL(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await removeJiraInstanceFromProject("https://acme.atlassian.net", "project-1");

    expect(capturedUrl!.searchParams.get("instanceUrl")).toBe("https://acme.atlassian.net");
    expect(capturedUrl!.searchParams.get("projectId")).toBe("project-1");
  });

  it("getJiraConfig passes the instance url as a query parameter", async () => {
    const instanceUrl = "https://acme.atlassian.net";
    let capturedUrl: string | null = null;

    server.use(
      http.get("/api/v1/jira/config/instance", ({ request }) => {
        capturedUrl = new URL(request.url).searchParams.get("instanceUrl");
        return HttpResponse.json({
          instanceUrl,
          autoUpdate: false,
          spec: { type: "INTERVAL", everyMinutes: 60 },
          schedule: "every 60m",
          nextSyncAt: null,
        });
      }),
    );

    const config = await getJiraConfig(instanceUrl);

    expect(capturedUrl).toBe(instanceUrl);
    expect(config).toMatchObject({
      instanceUrl,
      autoUpdate: false,
      spec: { type: "INTERVAL", everyMinutes: 60 },
      nextSyncAt: null,
    });
  });

  it("getJiraConfig rejects with an ApiError on 404", async () => {
    const instanceUrl = "https://missing.atlassian.net";

    server.use(
      http.get("/api/v1/jira/config/instance", () =>
        HttpResponse.json({ message: "unknown instance" }, { status: 404 }),
      ),
    );

    await expect(getJiraConfig(instanceUrl)).rejects.toThrow();
  });

  it("configureAllJiraInstances sends the typed global schedule payload", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/jira/config", async ({ request }) => {
        expect(await request.json()).toEqual({
          autoUpdate: true,
          schedule: {
            type: "WEEKLY",
            time: "09:00",
            daysOfWeek: ["MONDAY", "THURSDAY"],
          },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureAllJiraInstances({
      autoUpdate: true,
      schedule: {
        type: "WEEKLY",
        time: "09:00",
        daysOfWeek: ["MONDAY", "THURSDAY"],
      },
    });
  });

  it("configureJiraInstance targets one instance via the request body", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/jira/config/configure", async ({ request }) => {
        expect(await request.json()).toEqual({
          instanceUrl: "https://acme.atlassian.net",
          autoUpdate: false,
          schedule: { type: "INTERVAL", everyMinutes: 30 },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureJiraInstance({
      instanceUrl: "https://acme.atlassian.net",
      autoUpdate: false,
      schedule: { type: "INTERVAL", everyMinutes: 30 },
    });
  });
});
