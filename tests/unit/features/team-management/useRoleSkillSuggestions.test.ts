import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoleSkillSuggestions } from "../../../../src/features/team-management/useRoleSkillSuggestions";
import { ApiError } from "../../../../src/services/apiClient";
import { suggestSkillsForRole } from "../../../../src/services/teamManagementService";

vi.mock("../../../../src/services/teamManagementService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../src/services/teamManagementService")>();
  return { ...actual, suggestSkillsForRole: vi.fn() };
});

const existingSkill = {
  id: "skill-1",
  name: "TypeScript",
  roleIds: ["role-1"],
  status: "ACTIVE" as const,
  category: "TECHNICAL",
  universal: false,
};

const suggestedSkill = {
  id: "skill-2",
  name: "React",
  roleIds: ["role-1"],
  status: "ACTIVE" as const,
  category: "TECHNICAL",
  universal: false,
};

describe("useRoleSkillSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the complete list and diffs newly added skill IDs", async () => {
    vi.mocked(suggestSkillsForRole).mockResolvedValue([existingSkill, suggestedSkill]);
    const { result } = renderHook(() => useRoleSkillSuggestions());

    let outcome: Awaited<ReturnType<typeof result.current.suggest>> | undefined;
    await act(async () => {
      outcome = await result.current.suggest("role-1", ["skill-1"]);
    });

    expect(suggestSkillsForRole).toHaveBeenCalledWith("role-1");
    expect(outcome).toEqual({
      ok: true,
      skills: [existingSkill, suggestedSkill],
      addedSkillIds: ["skill-2"],
    });
    expect(result.current.isSuggesting).toBeNull();
  });

  it("maps a 502 to the AI-service-unavailable message", async () => {
    vi.mocked(suggestSkillsForRole).mockRejectedValue(new ApiError(502, "Bad Gateway"));
    const { result } = renderHook(() => useRoleSkillSuggestions());

    let outcome: Awaited<ReturnType<typeof result.current.suggest>> | undefined;
    await act(async () => {
      outcome = await result.current.suggest("role-1", []);
    });

    expect(outcome).toEqual({
      ok: false,
      message: "AI service unavailable. Try again in a moment.",
    });
  });

  it("uses the API error fallback for another failure without a message", async () => {
    vi.mocked(suggestSkillsForRole).mockRejectedValue(new ApiError(500, ""));
    const { result } = renderHook(() => useRoleSkillSuggestions());

    let outcome: Awaited<ReturnType<typeof result.current.suggest>> | undefined;
    await act(async () => {
      outcome = await result.current.suggest("role-1", []);
    });

    expect(outcome).toEqual({
      ok: false,
      message: "Could not suggest skills for this role.",
    });
  });
});
