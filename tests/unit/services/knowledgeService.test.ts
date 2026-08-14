import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { knowledgeService } from "../../../src/services/knowledgeService";
import { apiClient } from "../../../src/services/apiClient";
import { server } from "../../unit/setup/vitest.setup";

vi.mock("../../../src/services/userService", () => ({
  userService: {
    getProfile: vi.fn().mockResolvedValue({ id: "user1" }),
  },
}));

describe("knowledgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore any vi.spyOn mocks (e.g. on apiClient.fetch) so a failed
    // assertion can't leak a mockResolvedValue into a later test.
    vi.restoreAllMocks();
  });

  describe("uploadDocuments", () => {
    it("uploads files and returns their results", async () => {
      server.use(
        http.post("/api/v1/uploads", () => {
          return HttpResponse.json([{ id: "up1", filename: "a.txt", status: "ok" }]);
        }),
      );

      const file = new File(["content"], "a.txt", { type: "text/plain" });
      const results = await knowledgeService.uploadDocuments("p1", [file]);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ filename: "a.txt", status: "success" });
    });

    it("captures a failed upload as a failed UploadResult", async () => {
      server.use(http.post("/api/v1/uploads", () => HttpResponse.json({}, { status: 500 })));

      const file = new File(["content"], "bad.txt", { type: "text/plain" });
      const results = await knowledgeService.uploadDocuments("p1", [file]);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("error");
      expect(results[0].filename).toBe("bad.txt");
      expect(results[0].error).toBeTruthy();
    });

    it("uploads multiple files, aggregating success and failure results", async () => {
      let callCount = 0;
      server.use(
        http.post("/api/v1/uploads", () => {
          callCount += 1;
          if (callCount === 2) {
            return HttpResponse.json({}, { status: 500 });
          }
          return HttpResponse.json([{ id: "ok1", filename: "good.txt", status: "ok" }]);
        }),
      );

      const goodFile = new File(["a"], "good.txt");
      const badFile = new File(["b"], "bad.txt");
      const results = await knowledgeService.uploadDocuments("p1", [goodFile, badFile]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("success");
      expect(results[1].status).toBe("error");
    });
  });

  describe("deleteUpload", () => {
    it("calls apiClient.fetch with DELETE method, the collection path, and a FormData body containing the DeleteArtifactsRequest JSON part", async () => {
      const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(undefined);

      await knowledgeService.deleteUpload("proj-1", "up-1", "remover-1");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [endpoint, options] = fetchSpy.mock.calls[0];
      expect(endpoint).toBe("/api/v1/uploads");
      expect(options?.method).toBe("DELETE");
      expect(options?.body).toBeInstanceOf(FormData);

      const formData = options?.body as FormData;
      const requestPart = formData.get("request");
      expect(requestPart).toBeInstanceOf(Blob);
      const payload: unknown = JSON.parse(await (requestPart as Blob).text());
      expect(payload).toEqual({
        artifactIds: ["up-1"],
        removerId: "remover-1",
        projectId: "proj-1",
      });
    });

    it("resolves on 204 No Content", async () => {
      server.use(http.delete("/api/v1/uploads", () => new HttpResponse(null, { status: 204 })));

      await expect(
        knowledgeService.deleteUpload("proj-1", "up-1", "remover-1"),
      ).resolves.toBeUndefined();
    });

    it("rejects with ApiError on 403", async () => {
      server.use(
        http.delete("/api/v1/uploads", () =>
          HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
        ),
      );

      await expect(
        knowledgeService.deleteUpload("proj-1", "up-1", "remover-1"),
      ).rejects.toMatchObject({ name: "ApiError", status: 403 });
    });
  });

  describe("streamArtifactSummary", () => {
    const projectId = "project-uuid";
    const artifactId = "artifact-uuid";

    function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
    }

    it("invokes onToken/onCitation/onDone for token, citation, and done events", async () => {
      server.use(
        http.get(
          `/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`,
          () =>
            new HttpResponse(
              makeStream([
                'data: {"type":"token","content":"## Key"}\n\n',
                'data: {"type":"token","content":" points"}\n\n',
                `data: {"type":"citation","artifactId":"${artifactId}","filename":"README.md","sourceUrl":"https://github.com/owner/repo/blob/main/README.md"}\n\n`,
                'data: {"type":"done"}\n\n',
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const onToken = vi.fn();
      const onCitation = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      await knowledgeService.streamArtifactSummary(projectId, artifactId, {
        onToken,
        onCitation,
        onDone,
        onError,
      });

      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onToken).toHaveBeenNthCalledWith(1, "## Key");
      expect(onToken).toHaveBeenNthCalledWith(2, " points");
      expect(onCitation).toHaveBeenCalledWith({
        artifactId,
        filename: "README.md",
        sourceUrl: "https://github.com/owner/repo/blob/main/README.md",
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("rejects with ApiError on 503 so callers can retry on indexing", async () => {
      server.use(
        http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
          HttpResponse.json({ detail: "AI service unavailable" }, { status: 503 }),
        ),
      );

      await expect(
        knowledgeService.streamArtifactSummary(projectId, artifactId, {
          onToken: vi.fn(),
          onCitation: vi.fn(),
          onDone: vi.fn(),
        }),
      ).rejects.toMatchObject({ name: "ApiError", status: 503 });
    });

    it("rejects with ApiError on 404", async () => {
      server.use(
        http.get(`/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`, () =>
          HttpResponse.json({ detail: "Not found" }, { status: 404 }),
        ),
      );

      await expect(
        knowledgeService.streamArtifactSummary(projectId, artifactId, {
          onToken: vi.fn(),
          onCitation: vi.fn(),
          onDone: vi.fn(),
        }),
      ).rejects.toMatchObject({ name: "ApiError", status: 404 });
    });

    it("calls onError and rejects with a plain Error on in-stream error event", async () => {
      server.use(
        http.get(
          `/api/v1/projects/${projectId}/artifacts/${artifactId}/summary`,
          () =>
            new HttpResponse(
              makeStream(['data: {"type":"error","message":"Model overload"}\n\n']),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const onError = vi.fn();

      await expect(
        knowledgeService.streamArtifactSummary(projectId, artifactId, {
          onToken: vi.fn(),
          onCitation: vi.fn(),
          onDone: vi.fn(),
          onError,
        }),
      ).rejects.toThrow("Model overload");

      expect(onError).toHaveBeenCalledWith("Model overload");
    });
  });

  describe("getUnifiedArtifacts", () => {
    const projectId = "proj-uuid";

    it("fetches a single page of artifacts", async () => {
      server.use(
        http.get(`/api/v1/projects/${projectId}/artifacts`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("page")).toBe("1");
          expect(url.searchParams.get("size")).toBe("100");
          return HttpResponse.json({
            items: [
              {
                id: "art-1",
                title: "doc1.md",
                artifactType: "FILE",
                sourceSystem: "GITHUB",
                sourceId: "src-1",
                sourceUrl: null,
                mime: "text/markdown",
                language: null,
                ingestedAt: "2026-01-01T00:00:00Z",
                createdAtSource: null,
                updatedAtSource: null,
                contentHash: null,
                ingestionRunId: null,
              },
            ],
            page: {
              totalPages: 1,
            },
          });
        }),
      );

      const artifacts = await knowledgeService.getUnifiedArtifacts(projectId);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].title).toBe("doc1.md");
    });

    it("fetches across multiple pages until all pages are retrieved", async () => {
      server.use(
        http.get(`/api/v1/projects/${projectId}/artifacts`, ({ request }) => {
          const url = new URL(request.url);
          const page = url.searchParams.get("page");
          if (page === "1") {
            return HttpResponse.json({
              items: [
                {
                  id: "art-1",
                  title: "page1.md",
                  artifactType: "FILE",
                  sourceSystem: "GITHUB",
                  sourceId: "src-1",
                  sourceUrl: null,
                  mime: "text/markdown",
                  language: null,
                  ingestedAt: "2026-01-01T00:00:00Z",
                  createdAtSource: null,
                  updatedAtSource: null,
                  contentHash: null,
                  ingestionRunId: null,
                },
              ],
              page: {
                totalPages: 2,
              },
            });
          }
          return HttpResponse.json({
            items: [
              {
                id: "art-2",
                title: "page2.md",
                artifactType: "FILE",
                sourceSystem: "GITHUB",
                sourceId: "src-2",
                sourceUrl: null,
                mime: "text/markdown",
                language: null,
                ingestedAt: "2026-01-01T00:00:00Z",
                createdAtSource: null,
                updatedAtSource: null,
                contentHash: null,
                ingestionRunId: null,
              },
            ],
            page: {
              totalPages: 2,
            },
          });
        }),
      );

      const artifacts = await knowledgeService.getUnifiedArtifacts(projectId);
      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].title).toBe("page1.md");
      expect(artifacts[1].title).toBe("page2.md");
    });

    it("propagates ApiError when the request fails with 500", async () => {
      server.use(
        http.get(`/api/v1/projects/${projectId}/artifacts`, () =>
          HttpResponse.json({ message: "Internal server error" }, { status: 500 }),
        ),
      );

      await expect(knowledgeService.getUnifiedArtifacts(projectId)).rejects.toMatchObject({
        name: "ApiError",
        status: 500,
      });
    });
  });
});
