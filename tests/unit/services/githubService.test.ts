import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup/vitest.setup";
import {
  configureAllGithubRepositories,
  configureGithubRepository,
  getGithubRepositoryConfig,
} from "../../../src/services/sources/githubService";

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
      http.put(
        "/api/v1/github/config/:owner/:name",
        async ({ params, request }) => {
          const body = await request.json();

          expect(params).toMatchObject({ owner: "sprint", name: "frontend" });
          expect(body).toEqual({
            autoUpdate: false,
            schedule: { type: "INTERVAL", everyMinutes: 60 },
          });

          return new HttpResponse(null, { status: 204 });
        },
      ),
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
