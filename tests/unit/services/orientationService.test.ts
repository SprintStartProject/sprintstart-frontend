import { describe, it, expect, vi, beforeEach } from "vitest";
import { orientationService } from "../../../src/services/orientationService";
import { apiClient } from "../../../src/services/apiClient";

describe("orientationService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads orientation scoped to the project", async () => {
    const orientation = {
      taskId: "t1",
      taskTitle: "Fix the header",
      taskUrl: null,
      packet: null,
      reason: "corpus is empty",
    };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(orientation);

    await expect(orientationService.fetchMyOrientation("p1")).resolves.toEqual(orientation);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/me/orientation?projectId=p1");
  });

  it("pins a hire-authored packet for their own current task", async () => {
    const packet = { taskId: "t1", taskTitle: "Fix the header", origin: "HUMAN" };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(packet);
    const input = {
      summary: "Do it.",
      sections: [{ step: "SET_UP" as const, title: "Run it", body: "make dev", citations: [] }],
    };

    await expect(orientationService.authorMyOrientation("p1", input)).resolves.toEqual(packet);
    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/me/orientation?projectId=p1", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  });

  it("hands a hire-authored packet back to the AI", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(undefined);

    await orientationService.revertMyOrientation("p1");

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/me/orientation?projectId=p1", {
      method: "DELETE",
    });
  });

  it("authors a task orientation on the PM surface, scoped to task and project", async () => {
    const packet = { taskId: "t1", origin: "HUMAN" };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(packet);
    const input = {
      summary: null,
      sections: [{ step: "SET_UP" as const, title: "Run it", body: "make dev", citations: [] }],
    };

    await orientationService.authorTaskOrientation("task-1", "p1", input);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/onboarding/orientation/tasks/task-1?projectId=p1",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  });

  it("reads a task orientation for authoring without triggering assembly", async () => {
    const orientation = {
      taskId: "task-1",
      taskTitle: "Fix",
      taskUrl: null,
      packet: null,
      reason: null,
    };
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue(orientation);

    await orientationService.fetchTaskOrientation("task-1", "p1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/onboarding/orientation/tasks/task-1?projectId=p1",
    );
  });

  it("propagates backend failures instead of swallowing them", async () => {
    vi.spyOn(apiClient, "fetch").mockRejectedValue(new Error("boom"));

    // There is no cached or placeholder packet to fall back to, by design.
    await expect(orientationService.fetchMyOrientation("p1")).rejects.toThrow("boom");
  });
});
