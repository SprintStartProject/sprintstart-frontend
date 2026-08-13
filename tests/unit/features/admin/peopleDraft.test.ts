import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../../../src/services/apiClient";
import {
  applyPeopleChanges,
  createEmptyPeopleDraft,
  stageManager,
} from "../../../../src/features/admin/peopleDraft";

vi.mock("../../../../src/services/projectService", () => ({
  projectService: {
    assignUsersToProject: vi.fn(),
    setProjectManager: vi.fn(),
    clearProjectManager: vi.fn(),
    removeUserFromProject: vi.fn(),
  },
}));

import { projectService } from "../../../../src/services/projectService";

describe("applyPeopleChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites a 400 from the manager assignment into a PM-role hint", async () => {
    vi.mocked(projectService.setProjectManager).mockRejectedValue(new ApiError(400, "Bad Request"));

    const draft = stageManager(createEmptyPeopleDraft("snap"), "u-1");

    await expect(applyPeopleChanges("proj-1", draft)).rejects.toThrow(
      /Project Manager \(PM\) role/,
    );
  });

  it("passes through a non-manager failure unchanged", async () => {
    vi.mocked(projectService.assignUsersToProject).mockRejectedValue(new Error("network down"));

    const draft = createEmptyPeopleDraft("snap");
    draft.addedUserIds.add("u-9");

    await expect(applyPeopleChanges("proj-1", draft)).rejects.toThrow("network down");
  });
});
