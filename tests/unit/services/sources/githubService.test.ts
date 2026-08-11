import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import {
  connectGithubRepository,
  connectRepositories,
  discoverRepositories,
  discoverOrgRepositories,
  getGithubPatNames,
  addGithubPat,
  updateGithubPat,
  deleteGithubPat,
  updateAllGithubRepositories,
  updateGithubRepository,
  addRepositoryToProject,
  removeRepositoryFromProject,
} from "../../../../src/services/sources/githubService";
import { server } from "../../../unit/setup/vitest.setup";

describe("githubService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("connectGithubRepository", () => {
    it("POSTs owner, name and tokenName and returns the transaction id", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post("/api/v1/github/connect", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ transactionId: "txn-1" });
        }),
      );

      const result = await connectGithubRepository({
        owner: "octocat",
        name: "Hello-World",
        tokenName: "default",
        projectId: "project-1",
      });

      expect(capturedBody).toEqual({
        owner: "octocat",
        name: "Hello-World",
        tokenName: "default",
        projectId: "project-1",
      });
      expect(result.transactionId).toBe("txn-1");
    });

    it("rejects when the backend returns a non-OK response", async () => {
      server.use(http.post("/api/v1/github/connect", () => HttpResponse.json({}, { status: 400 })));

      await expect(
        connectGithubRepository({
          owner: "o",
          name: "n",
          tokenName: "t",
          projectId: "project-1",
        }),
      ).rejects.toMatchObject({ name: "ApiError", status: 400 });
    });
  });

  describe("addRepositoryToProject", () => {
    it("POSTs to the connections endpoint and returns the project assignment", async () => {
      let capturedPath: string | null = null;
      let capturedMethod: string | null = null;
      server.use(
        http.post("/api/v1/github/connections/:repositoryId/projects/:projectId", ({ request }) => {
          const url = new URL(request.url);
          capturedPath = url.pathname;
          capturedMethod = request.method;
          return HttpResponse.json({
            repositoryId: "repo-uuid",
            projectIds: ["project-1", "project-2"],
          });
        }),
      );

      const result = await addRepositoryToProject("repo-uuid", "project-2");

      expect(capturedMethod).toBe("POST");
      expect(capturedPath).toBe("/api/v1/github/connections/repo-uuid/projects/project-2");
      expect(result.projectIds).toEqual(["project-1", "project-2"]);
    });

    it("propagates a 403 as an ApiError", async () => {
      server.use(
        http.post("/api/v1/github/connections/:repositoryId/projects/:projectId", () =>
          HttpResponse.json({}, { status: 403 }),
        ),
      );

      await expect(addRepositoryToProject("repo-uuid", "project-2")).rejects.toMatchObject({
        name: "ApiError",
        status: 403,
      });
    });
  });

  describe("removeRepositoryFromProject", () => {
    it("DELETEs the connections endpoint and returns the project assignment", async () => {
      let capturedPath: string | null = null;
      let capturedMethod: string | null = null;
      server.use(
        http.delete(
          "/api/v1/github/connections/:repositoryId/projects/:projectId",
          ({ request }) => {
            const url = new URL(request.url);
            capturedPath = url.pathname;
            capturedMethod = request.method;
            return HttpResponse.json({
              repositoryId: "repo-uuid",
              projectIds: ["project-1"],
            });
          },
        ),
      );

      const result = await removeRepositoryFromProject("repo-uuid", "project-2");

      expect(capturedMethod).toBe("DELETE");
      expect(capturedPath).toBe("/api/v1/github/connections/repo-uuid/projects/project-2");
      expect(result.projectIds).toEqual(["project-1"]);
    });

    it("surfaces the { message } body of a 404 as the ApiError message", async () => {
      server.use(
        http.delete("/api/v1/github/connections/:repositoryId/projects/:projectId", () =>
          HttpResponse.json({ message: "Repository connection not found." }, { status: 404 }),
        ),
      );

      await expect(removeRepositoryFromProject("repo-uuid", "project-2")).rejects.toMatchObject({
        name: "ApiError",
        status: 404,
        message: "Repository connection not found.",
      });
    });
  });

  describe("getGithubPatNames", () => {
    it("returns the list of PAT names", async () => {
      server.use(http.get("/api/v1/github/pat", () => HttpResponse.json(["default", "ci"])));
      const result = await getGithubPatNames();
      expect(result).toEqual(["default", "ci"]);
    });
  });

  describe("addGithubPat", () => {
    it("POSTs name and token", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post("/api/v1/github/pat", async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 200 });
        }),
      );

      await addGithubPat("ci", "secret-token");
      expect(capturedBody).toEqual({ name: "ci", token: "secret-token" });
    });
  });

  describe("updateGithubPat", () => {
    it("PUTs name and newToken", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.put("/api/v1/github/pat/update", async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 200 });
        }),
      );

      await updateGithubPat("ci", "new-secret");
      expect(capturedBody).toEqual({ name: "ci", newToken: "new-secret" });
    });
  });

  describe("deleteGithubPat", () => {
    it("PUTs the name to the delete endpoint", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.put("/api/v1/github/pat/delete", async ({ request }) => {
          capturedBody = await request.json();
          return new HttpResponse(null, { status: 200 });
        }),
      );

      await deleteGithubPat("ci");
      expect(capturedBody).toEqual({ name: "ci" });
    });
  });

  describe("updateAllGithubRepositories", () => {
    it("POSTs to update-all and returns the transaction id", async () => {
      server.use(
        http.post("/api/v1/github/update-all", () =>
          HttpResponse.json([{ transactionId: "txn-all" }]),
        ),
      );
      const result = await updateAllGithubRepositories();
      expect(result[0]?.transactionId).toBe("txn-all");
    });
  });

  describe("updateGithubRepository", () => {
    it("POSTs owner and name to update", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post("/api/v1/github/update", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ transactionId: "txn-one" });
        }),
      );

      const result = await updateGithubRepository({ owner: "octocat", name: "Hello-World" });
      expect(capturedBody).toEqual({ owner: "octocat", name: "Hello-World" });
      expect(result.transactionId).toBe("txn-one");
    });
  });

  describe("discoverOrgRepositories", () => {
    it("maps private/html_url and flags a full page as hasMore", async () => {
      let capturedUrl = "";
      server.use(
        http.get("/api/v1/github/discover/org/:org", ({ request, params }) => {
          capturedUrl = request.url;
          expect(params.org).toBe("SprintStartProject");
          return HttpResponse.json({
            repositories: Array.from({ length: 20 }, (_, i) => ({
              name: `repo-${i}`,
              private: i % 2 === 0,
              html_url: `https://github.com/SprintStartProject/repo-${i}`,
              alreadyConnected: i === 0,
              isEnabled: i === 0 ? true : null,
            })),
          });
        }),
      );

      const result = await discoverOrgRepositories("SprintStartProject", "default", 0, 20);

      expect(capturedUrl).toContain("tokenName=default");
      expect(capturedUrl).toContain("page=0");
      expect(capturedUrl).toContain("pageSize=20");
      expect(result.repositories).toHaveLength(20);
      expect(result.repositories[0]).toEqual({
        name: "repo-0",
        isPrivate: true,
        url: "https://github.com/SprintStartProject/repo-0",
        alreadyConnected: true,
        isEnabled: true,
      });
      expect(result.hasMore).toBe(true);
      expect(result.resolvedOwnerType).toBe("org");
    });

    it("does not flag hasMore for a partial page", async () => {
      server.use(
        http.get("/api/v1/github/discover/org/:org", () =>
          HttpResponse.json({
            repositories: [{ name: "only", private: false, html_url: "https://github.com/o/only" }],
          }),
        ),
      );

      const result = await discoverOrgRepositories("o", "default", 0, 20);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("discoverRepositories (auto)", () => {
    it("falls back to the user endpoint when the org endpoint 404s", async () => {
      let userEndpointHit = false;
      server.use(
        http.get("/api/v1/github/discover/org/:org", () => HttpResponse.json({}, { status: 404 })),
        http.get("/api/v1/github/discover/user/:user", ({ params }) => {
          userEndpointHit = true;
          expect(params.user).toBe("octocat");
          return HttpResponse.json({
            repositories: [
              {
                name: "Hello-World",
                private: false,
                html_url: "https://github.com/octocat/Hello-World",
              },
            ],
          });
        }),
      );

      const result = await discoverRepositories("octocat", "default", "auto", 0, 20);

      expect(userEndpointHit).toBe(true);
      expect(result.resolvedOwnerType).toBe("user");
      expect(result.repositories[0]?.name).toBe("Hello-World");
    });

    it("propagates a non-404 error without falling back", async () => {
      server.use(
        http.get("/api/v1/github/discover/org/:org", () => HttpResponse.json({}, { status: 403 })),
      );

      await expect(discoverRepositories("octocat", "default", "auto", 0, 20)).rejects.toMatchObject(
        { name: "ApiError", status: 403 },
      );
    });
  });

  describe("connectRepositories", () => {
    it("POSTs one entry per repo with the shared token and project", async () => {
      let capturedBody: unknown = null;
      server.use(
        http.post("/api/v1/github/connect/all", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            transactionIdsByRepositoryId: { "octocat/a": "txn-a", "octocat/b": "txn-b" },
          });
        }),
      );

      const result = await connectRepositories(
        [
          { owner: "octocat", name: "a" },
          { owner: "octocat", name: "b" },
        ],
        "default",
        "project-1",
      );

      expect(capturedBody).toEqual({
        repositories: [
          { owner: "octocat", name: "a", tokenName: "default", projectId: "project-1" },
          { owner: "octocat", name: "b", tokenName: "default", projectId: "project-1" },
        ],
      });
      expect(result.transactionIdsByRepositoryId["octocat/a"]).toBe("txn-a");
    });
  });
});
