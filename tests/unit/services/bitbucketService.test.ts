import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  addBitbucketRepositoryToProject,
  configureAllBitbucketRepositories,
  configureBitbucketRepository,
  connectBitbucketRepositories,
  connectBitbucketRepository,
  discoverBitbucketRepositories,
  getBitbucketRepositoryConfig,
  removeBitbucketRepositoryFromProject,
  updateAllBitbucketRepositories,
  updateBitbucketRepository,
} from "../../../src/services/sources/bitbucketService";

const discoverEndpoint = "/api/v1/bitbucket/discover/workspace/:workspace";

const backendRepository = (slug: string, overrides: Record<string, unknown> = {}) => ({
  workspace: "acme",
  slug,
  name: slug,
  isPrivate: false,
  url: `https://bitbucket.org/acme/${slug}`,
  alreadyConnected: false,
  enabled: null,
  ...overrides,
});

describe("connectBitbucketRepository", () => {
  it("posts the workspace, slug, credential and project", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/bitbucket", async ({ request }) => {
        expect(await request.json()).toEqual({
          workspace: "acme",
          slug: "widgets",
          credentialName: "atlassian-main",
          projectId: "project-1",
        });

        return HttpResponse.json({ transactionId: "tx-1" }, { status: 202 });
      }),
    );

    const response = await connectBitbucketRepository({
      workspace: "acme",
      slug: "widgets",
      credentialName: "atlassian-main",
      projectId: "project-1",
    });

    expect(response).toEqual({ transactionId: "tx-1" });
  });
});

describe("connectBitbucketRepositories", () => {
  it("sends one entry per repository, each with the shared credential and project", async () => {
    expect.assertions(2);

    server.use(
      http.post("/api/v1/bitbucket/connect/all", async ({ request }) => {
        expect(await request.json()).toEqual({
          repositories: [
            {
              workspace: "acme",
              slug: "widgets",
              credentialName: "atlassian-main",
              projectId: "project-1",
            },
            {
              workspace: "acme",
              slug: "gadgets",
              credentialName: "atlassian-main",
              projectId: "project-1",
            },
          ],
        });

        return HttpResponse.json(
          { transactionIdsByRepository: { "acme/widgets": "tx-1", "acme/gadgets": "tx-2" } },
          { status: 202 },
        );
      }),
    );

    const result = await connectBitbucketRepositories(
      [
        { workspace: "acme", slug: "widgets" },
        { workspace: "acme", slug: "gadgets" },
      ],
      "atlassian-main",
      "project-1",
    );

    expect(result.transactionIdsByRepository).toEqual({
      "acme/widgets": "tx-1",
      "acme/gadgets": "tx-2",
    });
  });
});

describe("discoverBitbucketRepositories", () => {
  it("passes the credential and the 0-based page in the query and the workspace in the path", async () => {
    expect.assertions(3);

    server.use(
      http.get(discoverEndpoint, ({ params, request }) => {
        const url = new URL(request.url);

        expect(params.workspace).toBe("acme team");
        expect(url.searchParams.get("credentialName")).toBe("atlassian-main");
        expect(Object.fromEntries(url.searchParams)).toMatchObject({ page: "2", pageSize: "10" });

        return HttpResponse.json({ repositories: [] });
      }),
    );

    await discoverBitbucketRepositories("acme team", "atlassian-main", 2, 10);
  });

  it("maps the repositories to the shape the UI consumes", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({
          repositories: [
            backendRepository("widgets", { isPrivate: true }),
            backendRepository("gadgets", { alreadyConnected: true, enabled: false }),
          ],
        }),
      ),
    );

    const result = await discoverBitbucketRepositories("acme", "atlassian-main");

    expect(result.repositories).toEqual([
      {
        workspace: "acme",
        slug: "widgets",
        name: "widgets",
        isPrivate: true,
        url: "https://bitbucket.org/acme/widgets",
        alreadyConnected: false,
        isEnabled: null,
      },
      {
        workspace: "acme",
        slug: "gadgets",
        name: "gadgets",
        isPrivate: false,
        url: "https://bitbucket.org/acme/gadgets",
        alreadyConnected: true,
        isEnabled: false,
      },
    ]);
  });

  it("reads the privacy flag whether the backend names it isPrivate or private", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({
          repositories: [
            { workspace: "acme", slug: "kotlin-style", name: "a", isPrivate: true },
            { workspace: "acme", slug: "jackson-style", name: "b", private: true },
            { workspace: "acme", slug: "missing", name: "c" },
          ],
        }),
      ),
    );

    const result = await discoverBitbucketRepositories("acme", "atlassian-main");

    expect(result.repositories.map((repository) => repository.isPrivate)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("defaults the optional fields when the backend omits them", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({
          repositories: [{ workspace: "acme", slug: "bare", name: "bare", url: null }],
        }),
      ),
    );

    const result = await discoverBitbucketRepositories("acme", "atlassian-main");

    expect(result.repositories[0]).toMatchObject({
      url: null,
      alreadyConnected: false,
      isEnabled: null,
    });
  });

  it("reports hasMore when a full page came back", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({ repositories: [backendRepository("a"), backendRepository("b")] }),
      ),
    );

    const result = await discoverBitbucketRepositories("acme", "atlassian-main", 0, 2);

    expect(result.hasMore).toBe(true);
  });

  it("reports no more pages when the page is short", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({ repositories: [backendRepository("a")] }),
      ),
    );

    const result = await discoverBitbucketRepositories("acme", "atlassian-main", 0, 2);

    expect(result.hasMore).toBe(false);
  });

  it("propagates a missing credential as a 404", async () => {
    server.use(
      http.get(discoverEndpoint, () =>
        HttpResponse.json({ message: "Credential not found" }, { status: 404 }),
      ),
    );

    await expect(discoverBitbucketRepositories("acme", "gone")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("bitbucketService project links", () => {
  it("addBitbucketRepositoryToProject posts to the connection's project path", async () => {
    server.use(
      http.post("/api/v1/bitbucket/connections/:repositoryId/projects/:projectId", ({ params }) =>
        HttpResponse.json({
          repositoryId: params.repositoryId,
          projectIds: ["project-1", params.projectId],
        }),
      ),
    );

    const response = await addBitbucketRepositoryToProject("repo-1", "project-2");

    expect(response).toEqual({ repositoryId: "repo-1", projectIds: ["project-1", "project-2"] });
  });

  it("removeBitbucketRepositoryFromProject deletes the link and returns the remaining projects", async () => {
    expect.assertions(2);

    server.use(
      http.delete(
        "/api/v1/bitbucket/connections/:repositoryId/projects/:projectId",
        ({ params }) => {
          expect(params).toMatchObject({ repositoryId: "repo-1", projectId: "project-1" });

          return HttpResponse.json({ repositoryId: "repo-1", projectIds: ["project-2"] });
        },
      ),
    );

    const response = await removeBitbucketRepositoryFromProject("repo-1", "project-1");

    expect(response.projectIds).toEqual(["project-2"]);
  });
});

describe("bitbucketService updates", () => {
  it("updateBitbucketRepository posts to the connection's update path", async () => {
    server.use(
      http.post("/api/v1/bitbucket/connections/:repositoryId/update", ({ params }) =>
        HttpResponse.json({ transactionId: `tx-${String(params.repositoryId)}` }, { status: 202 }),
      ),
    );

    await expect(updateBitbucketRepository("repo-1")).resolves.toEqual({
      transactionId: "tx-repo-1",
    });
  });

  it("updateAllBitbucketRepositories returns the transaction ids keyed by workspace/slug", async () => {
    server.use(
      http.post("/api/v1/bitbucket/update-all", () =>
        HttpResponse.json(
          { transactionIdsByRepository: { "acme/widgets": "tx-1" } },
          { status: 202 },
        ),
      ),
    );

    await expect(updateAllBitbucketRepositories()).resolves.toEqual({
      transactionIdsByRepository: { "acme/widgets": "tx-1" },
    });
  });
});

describe("bitbucketService config endpoints", () => {
  it("configureAllBitbucketRepositories sends the typed global schedule payload", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/bitbucket/config", async ({ request }) => {
        expect(await request.json()).toEqual({
          autoUpdate: true,
          schedule: { type: "WEEKLY", time: "09:00:00", daysOfWeek: ["MONDAY", "THURSDAY"] },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureAllBitbucketRepositories({
      autoUpdate: true,
      schedule: { type: "WEEKLY", time: "09:00:00", daysOfWeek: ["MONDAY", "THURSDAY"] },
    });
  });

  it("configureBitbucketRepository targets one repository config", async () => {
    expect.assertions(2);

    server.use(
      http.put("/api/v1/bitbucket/config/:workspace/:slug", async ({ params, request }) => {
        expect(params).toMatchObject({ workspace: "sprint", slug: "frontend" });
        expect(await request.json()).toEqual({
          autoUpdate: false,
          schedule: { type: "INTERVAL", everyMinutes: 60 },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureBitbucketRepository(
      { workspace: "sprint", slug: "frontend" },
      { autoUpdate: false, schedule: { type: "INTERVAL", everyMinutes: 60 } },
    );
  });

  it("encodes the workspace and slug into the config path", async () => {
    expect.assertions(1);

    server.use(
      http.get("/api/v1/bitbucket/config/:workspace/:slug", ({ request }) => {
        expect(new URL(request.url).pathname).toBe("/api/v1/bitbucket/config/a%20b/c%2Fd");

        return HttpResponse.json({});
      }),
    );

    await getBitbucketRepositoryConfig("a b", "c/d");
  });

  it("getBitbucketRepositoryConfig returns repository sync settings", async () => {
    server.use(
      http.get("/api/v1/bitbucket/config/sprint/frontend", () =>
        HttpResponse.json({
          id: "config-1",
          workspace: "sprint",
          slug: "frontend",
          autoUpdate: true,
          spec: { type: "DAILY", time: "02:00:00" },
          schedule: "0 0 2 * * *",
          nextSyncAt: "2026-01-01T02:00:00Z",
        }),
      ),
    );

    const config = await getBitbucketRepositoryConfig("sprint", "frontend");

    expect(config).toMatchObject({
      workspace: "sprint",
      slug: "frontend",
      autoUpdate: true,
      spec: { type: "DAILY", time: "02:00:00" },
      nextSyncAt: "2026-01-01T02:00:00Z",
    });
  });
});
