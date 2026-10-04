import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { projectAnalysisService } from "../../../src/services/projectAnalysisService";
import { server } from "../../unit/setup/vitest.setup";

const run = {
  id: "run-1",
  at: "2026-10-01T10:00:00Z",
  score: 72,
  counts: { critical: 1, warning: 0, info: 0, good: 0 },
  failedChecks: 0,
  findings: [],
  tasks: [],
};

describe("projectAnalysisService", () => {
  it("reads a project's runs, asking for the given number", async () => {
    let url: URL | null = null;
    server.use(
      http.get("/api/v1/insights/project-analysis/runs", ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json([run]);
      }),
    );

    const result = await projectAnalysisService.listRuns("project-1", 5);

    expect(result).toEqual([run]);
    expect(url!.searchParams.get("projectId")).toBe("project-1");
    expect(url!.searchParams.get("limit")).toBe("5");
  });

  it("stores a run and returns it as the backend kept it", async () => {
    let body: unknown = null;
    server.use(
      http.post("/api/v1/insights/project-analysis/runs", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(run, { status: 201 });
      }),
    );

    const result = await projectAnalysisService.saveRun("project-1", {
      score: 72,
      findings: [],
      tasks: [],
    });

    expect(result).toEqual(run);
    expect(body).toEqual({ score: 72, findings: [], tasks: [] });
  });

  // A made-up history would compare a real run with a score nobody ever saw.
  it("propagates a failure instead of standing in for the backend", async () => {
    server.use(
      http.get("/api/v1/insights/project-analysis/runs", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );

    await expect(projectAnalysisService.listRuns("project-1")).rejects.toThrow();
  });
});
