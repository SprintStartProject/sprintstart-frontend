import { describe, it, expect, vi, beforeEach } from "vitest";
import { onboardingMetricsService } from "../../../src/services/onboardingMetricsService";
import { apiClient } from "../../../src/services/apiClient";

describe("onboardingMetricsService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a project's metrics from the project-scoped endpoint", async () => {
    const metrics = { projectId: "p1", memberCount: 2, hires: [] };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(metrics);

    await expect(onboardingMetricsService.fetchProjectMetrics("p1")).resolves.toEqual(metrics);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/metrics/projects/p1");
  });

  it("reads one hire's timeline from the user-scoped endpoint", async () => {
    const timeline = { userId: "u1", displayName: "Ada" };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(timeline);

    await expect(onboardingMetricsService.fetchHireTimeline("p1", "u1")).resolves.toEqual(timeline);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/metrics/projects/p1/users/u1");
  });

  it("reads the caller's own timeline from the self-serve endpoint", async () => {
    const timeline = { userId: "u1", displayName: "Ada" };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(timeline);

    await expect(onboardingMetricsService.fetchMyTimeline("p1")).resolves.toEqual(timeline);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/metrics/me?projectId=p1");
  });

  it("reads the attention list from the metrics endpoint", async () => {
    const list = { projectId: "p1", memberCount: 2, items: [] };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(list);

    await expect(onboardingMetricsService.fetchAttention("p1")).resolves.toEqual(list);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/metrics/projects/p1/attention");
  });

  it("propagates backend failures instead of swallowing them", async () => {
    vi.spyOn(apiClient, "fetch").mockRejectedValue(new Error("boom"));

    await expect(onboardingMetricsService.fetchProjectMetrics("p1")).rejects.toThrow("boom");
  });
});
