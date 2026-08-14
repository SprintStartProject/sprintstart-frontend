import { describe, it, expect, vi, beforeEach } from "vitest";
import { starterWorkService } from "../../../src/services/starterWorkService";
import { apiClient } from "../../../src/services/apiClient";

describe("starterWorkService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reads candidate issues scoped to the project", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue([]);

    await expect(starterWorkService.fetchCandidates("p1")).resolves.toEqual([]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/onboarding/starter-work/candidates?projectId=p1",
    );
  });

  /**
   * Only the source id is sent. Title and link come from the ingested issue server-side, so the
   * pool cannot disagree with the tracker about what an issue is called.
   */
  it("promotes an issue by source id alone", async () => {
    const fetchSpy = vi.spyOn(apiClient, "fetch").mockResolvedValue({ id: "t1" });

    await starterWorkService.promoteCandidate({ sourceId: "github:acme/repo:ISSUE:1" });

    expect(fetchSpy).toHaveBeenCalledWith("/api/v1/onboarding/starter-work/candidates/promote", {
      method: "POST",
      body: JSON.stringify({ sourceId: "github:acme/repo:ISSUE:1" }),
    });
  });

  it("surfaces a refused promotion rather than swallowing it", async () => {
    vi.spyOn(apiClient, "fetch").mockRejectedValue(new Error("is not re-addable"));

    await expect(
      starterWorkService.promoteCandidate({ sourceId: "github:acme/repo:ISSUE:1" }),
    ).rejects.toThrow(/not re-addable/);
  });
});
