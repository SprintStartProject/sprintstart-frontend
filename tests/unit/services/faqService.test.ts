import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { insightsService } from "../../../src/services/faqService";
import { server } from "../../unit/setup/vitest.setup";

describe("faqService", () => {
  const projectId = "project-1";
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchFAQGroups", () => {
    it("returns the backend FAQ overview on success", async () => {
      const overview = {
        totalQuestions: 5,
        groups: [{ id: "g1", title: "Group 1", questionCount: 3 }],
      };
      server.use(http.get("/api/v1/insights/faq", () => HttpResponse.json(overview)));

      const result = await insightsService.fetchFAQGroups(projectId);

      expect(result).toEqual(overview);
    });

    // Previously answered with a fixture, which the caller could not tell from a
    // real FAQ -- an unreachable backend simply rendered as different entries.
    it("propagates a failure instead of standing in for the backend", async () => {
      server.use(http.get("/api/v1/insights/faq", () => HttpResponse.json({}, { status: 500 })));

      await expect(insightsService.fetchFAQGroups(projectId)).rejects.toThrow();
    });
  });

  describe("fetchFAQGroup", () => {
    it("returns the backend FAQ detail on success", async () => {
      const detail = {
        id: "g1",
        title: "Group 1",
        questions: [{ id: "q1", question: "Why?" }],
        documents: [],
      };
      server.use(http.get("/api/v1/insights/faq/g1", () => HttpResponse.json(detail)));

      const result = await insightsService.fetchFAQGroup(projectId, "g1");

      expect(result).toEqual(detail);
    });

    it("propagates a failure instead of standing in for the backend", async () => {
      server.use(http.get("/api/v1/insights/faq/g1", () => HttpResponse.json({}, { status: 500 })));

      await expect(insightsService.fetchFAQGroup(projectId, "g1")).rejects.toThrow();
    });
  });
});
