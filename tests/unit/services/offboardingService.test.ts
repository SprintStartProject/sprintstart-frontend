import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { offboardingService } from "../../../src/services/offboardingService";
import type { RiskMap } from "../../../src/services/offboardingTypes";
import { server } from "../setup/vitest.setup";

const map: RiskMap = {
  asOf: "2026-11-20T12:00:00Z",
  settings: {
    halfLifeDays: 152,
    inactiveAfterDays: 365,
    authorThreshold: 0.75,
    knowledgeWeight: 0.7,
    activityWeight: 0.3,
    name: "default",
    sourceWeights: { commits: 1 },
  },
  departing: ["ada"],
  unknownDeparting: [],
  summary: { files: 4, orphaned: 1, hoarded: 0, alreadyOrphaned: 0, listed: 1 },
  files: [],
};

describe("offboardingService.fetchRiskMap", () => {
  it("asks the project's risk endpoint with every leaving person as its own parameter", async () => {
    let requested: URL | null = null;
    server.use(
      http.get("/api/v1/projects/proj%201/offboarding/risk", ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(map);
      }),
    );

    const result = await offboardingService.fetchRiskMap("proj 1", {
      leaving: ["ada@example.com", "ben"],
      asOf: "2026-11-20T23:59:59Z",
      reviewWeight: 0.5,
      ranking: "placeholder",
      knowledge: "time-weighted",
      limit: 200,
    });

    expect(result).toEqual(map);
    expect(requested!.searchParams.getAll("leaving")).toEqual(["ada@example.com", "ben"]);
    expect(requested!.searchParams.get("asOf")).toBe("2026-11-20T23:59:59Z");
    expect(requested!.searchParams.get("reviewWeight")).toBe("0.5");
    expect(requested!.searchParams.get("ranking")).toBe("placeholder");
    expect(requested!.searchParams.get("knowledge")).toBe("time-weighted");
    expect(requested!.searchParams.get("limit")).toBe("200");
  });

  it("leaves out the settings that were not given", async () => {
    let requested: URL | null = null;
    server.use(
      http.get("/api/v1/projects/p1/offboarding/risk", ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(map);
      }),
    );

    await offboardingService.fetchRiskMap("p1", { leaving: ["ada"] });

    expect(requested!.searchParams.has("asOf")).toBe(false);
    expect(requested!.searchParams.has("reviewWeight")).toBe(false);
    expect(requested!.searchParams.has("ranking")).toBe(false);
    expect(requested!.searchParams.has("knowledge")).toBe(false);
    expect(requested!.searchParams.has("limit")).toBe(false);
  });

  it("keeps a review weight of zero, which is not the same as none", async () => {
    let requested: URL | null = null;
    server.use(
      http.get("/api/v1/projects/p1/offboarding/risk", ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json(map);
      }),
    );

    await offboardingService.fetchRiskMap("p1", { leaving: ["ada"], reviewWeight: 0 });

    expect(requested!.searchParams.get("reviewWeight")).toBe("0");
  });

  it("propagates a refusal instead of standing in for a ranking", async () => {
    server.use(
      http.get("/api/v1/projects/p1/offboarding/risk", () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );

    await expect(offboardingService.fetchRiskMap("p1", { leaving: ["ada"] })).rejects.toThrow();
  });
});

describe("offboardingService.fetchMembers", () => {
  it("asks the project's members endpoint", async () => {
    const overview = { matched: 1, total: 2, members: [] };
    server.use(
      http.get("/api/v1/projects/proj%201/offboarding/identities/members", () =>
        HttpResponse.json(overview),
      ),
    );

    expect(await offboardingService.fetchMembers("proj 1")).toEqual(overview);
  });

  it("propagates a refusal", async () => {
    server.use(
      http.get("/api/v1/projects/p1/offboarding/identities/members", () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );

    await expect(offboardingService.fetchMembers("p1")).rejects.toThrow();
  });
});
