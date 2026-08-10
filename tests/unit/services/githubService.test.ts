import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  configureAllGithubRepositories,
  configureGithubRepository,
  discoverRepositories,
  getGithubRepositoryConfig,
} from "../../../src/services/sources/githubService";

const orgEndpoint = "/api/v1/github/discover/org/:owner";
const userEndpoint = "/api/v1/github/discover/user/:owner";

const userReposResponse = () =>
  HttpResponse.json({
    repositories: [
      { name: "dotfiles", private: false, html_url: "https://github.com/octocat/dotfiles" },
    ],
  });

describe("discoverRepositories auto owner-type resolution", () => {
  it("returns the org repositories when the owner is an organization", async () => {
    server.use(
      http.get(orgEndpoint, () =>
        HttpResponse.json({
          repositories: [
            { name: "widgets", private: false, html_url: "https://github.com/acme/widgets" },
          ],
        }),
      ),
      http.get(userEndpoint, () => new HttpResponse(null, { status: 500 })),
    );

    const result = await discoverRepositories("acme", "team-pat");

    expect(result.resolvedOwnerType).toBe("org");
    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0]).toMatchObject({ name: "widgets" });
  });

  it("falls back to the user endpoint when the org endpoint answers 404", async () => {
    server.use(
      http.get(orgEndpoint, () => new HttpResponse(null, { status: 404 })),
      http.get(userEndpoint, userReposResponse),
    );

    const result = await discoverRepositories("octocat", "team-pat");

    expect(result.resolvedOwnerType).toBe("user");
    expect(result.repositories[0]).toMatchObject({ name: "dotfiles" });
  });

  it("falls back to the user endpoint when the org endpoint fails with a 5xx", async () => {
    // The backend surfaces GitHub's "not an org" 404 as a 500, so a server error
    // from the org endpoint must still be treated as "maybe it's a user".
    server.use(
      http.get(orgEndpoint, () => new HttpResponse(null, { status: 500 })),
      http.get(userEndpoint, userReposResponse),
    );

    const result = await discoverRepositories("octocat", "team-pat");

    expect(result.resolvedOwnerType).toBe("user");
    expect(result.repositories[0]).toMatchObject({ name: "dotfiles" });
  });

  it("does not fall back to the user endpoint on a 403 from the org endpoint", async () => {
    let userEndpointCalled = false;
    server.use(
      http.get(orgEndpoint, () =>
        HttpResponse.json({ message: "Insufficient role" }, { status: 403 }),
      ),
      http.get(userEndpoint, () => {
        userEndpointCalled = true;
        return userReposResponse();
      }),
    );

    await expect(discoverRepositories("acme", "team-pat")).rejects.toMatchObject({
      status: 403,
    });
    expect(userEndpointCalled).toBe(false);
  });
});

describe("githubService config endpoints", () => {
  it("configureAllGithubRepositories sends the typed global schedule payload", async () => {
    expect.assertions(1);

    server.use(
      http.put("/api/v1/github/config/global", async ({ request }) => {
        const body = await request.json();

        expect(body).toEqual({
          autoUpdate: true,
          schedule: {
            type: "WEEKLY",
            time: "09:00:00",
            daysOfWeek: ["MONDAY", "THURSDAY"],
          },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureAllGithubRepositories({
      autoUpdate: true,
      schedule: {
        type: "WEEKLY",
        time: "09:00:00",
        daysOfWeek: ["MONDAY", "THURSDAY"],
      },
    });
  });

  it("configureGithubRepository targets one repository config", async () => {
    expect.assertions(2);

    server.use(
      http.put("/api/v1/github/config/:owner/:name", async ({ params, request }) => {
        const body = await request.json();

        expect(params).toMatchObject({ owner: "sprint", name: "frontend" });
        expect(body).toEqual({
          autoUpdate: false,
          schedule: { type: "INTERVAL", everyMinutes: 60 },
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await configureGithubRepository(
      { owner: "sprint", name: "frontend" },
      {
        autoUpdate: false,
        schedule: { type: "INTERVAL", everyMinutes: 60 },
      },
    );
  });

  it("getGithubRepositoryConfig returns repository sync settings", async () => {
    server.use(
      http.get("/api/v1/github/config/sprint/frontend", () =>
        HttpResponse.json({
          id: "config-1",
          repositoryOwner: "sprint",
          repositoryName: "frontend",
          autoUpdate: true,
          spec: { type: "DAILY", time: "02:00:00" },
          schedule: "0 0 2 * * *",
          nextSyncAt: "2026-01-01T02:00:00Z",
        }),
      ),
    );

    const config = await getGithubRepositoryConfig({
      owner: "sprint",
      name: "frontend",
    });

    expect(config).toMatchObject({
      autoUpdate: true,
      spec: { type: "DAILY", time: "02:00:00" },
      nextSyncAt: "2026-01-01T02:00:00Z",
    });
  });
});
