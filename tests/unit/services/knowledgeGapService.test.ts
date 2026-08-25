import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { knowledgeGapService } from "../../../src/services/knowledgeGapService";
import { server } from "../../unit/setup/vitest.setup";

describe("knowledgeGapService", () => {
  const projectId = "project-1";
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchKnowledgeGaps", () => {
    it("returns the backend overview on success", async () => {
      const overview = {
        totalGaps: 3,
        severitySummary: { high: 1, medium: 1, low: 1 },
        gaps: [{ id: "g1", title: "Gap 1", severity: "high" }],
      };
      server.use(http.get("/api/v1/insights/knowledge-gaps", () => HttpResponse.json(overview)));

      const result = await knowledgeGapService.fetchKnowledgeGaps(projectId);

      expect(result).toEqual(overview);
    });

    // Previously answered with a fixture, which the caller could not tell from a
    // real result -- an unreachable backend simply rendered as a different set
    // of gaps, and the panel's error state was unreachable.
    it("propagates a failure instead of standing in for the backend", async () => {
      server.use(
        http.get("/api/v1/insights/knowledge-gaps", () => HttpResponse.json({}, { status: 500 })),
      );

      await expect(knowledgeGapService.fetchKnowledgeGaps(projectId)).rejects.toThrow();
    });

    // A 404 was treated as "nothing scanned yet" and swallowed. It is still a
    // failed read, and the panel now has a state that says so.
    it("propagates a 404 rather than swallowing it", async () => {
      server.use(
        http.get("/api/v1/insights/knowledge-gaps", () => new HttpResponse(null, { status: 404 })),
      );

      await expect(knowledgeGapService.fetchKnowledgeGaps(projectId)).rejects.toThrow();
    });
  });

  describe("fetchKnowledgeGap", () => {
    it("returns the backend gap detail on success", async () => {
      const detail = { id: "g1", title: "Gap 1", severity: "high", missingTypes: [] };
      server.use(http.get("/api/v1/insights/knowledge-gaps/g1", () => HttpResponse.json(detail)));

      const result = await knowledgeGapService.fetchKnowledgeGap(projectId, "g1");

      expect(result).toEqual(detail);
    });

    it("propagates a 404 rather than inventing a gap that does not exist", async () => {
      server.use(
        http.get(
          "/api/v1/insights/knowledge-gaps/missing",
          () => new HttpResponse(null, { status: 404 }),
        ),
      );

      await expect(knowledgeGapService.fetchKnowledgeGap(projectId, "missing")).rejects.toThrow();
    });

    it("propagates a failure instead of standing in for the backend", async () => {
      server.use(
        http.get("/api/v1/insights/knowledge-gaps/g2", () =>
          HttpResponse.json({}, { status: 500 }),
        ),
      );

      await expect(knowledgeGapService.fetchKnowledgeGap(projectId, "g2")).rejects.toThrow();
    });
  });
});
