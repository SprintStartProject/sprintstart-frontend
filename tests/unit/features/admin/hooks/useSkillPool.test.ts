import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSkillPool } from "../../../../../src/features/admin/hooks/useSkillPool";

vi.mock("../../../../../src/services/teamManagementService", () => ({
  getSkills: vi.fn(),
  getProjectRoles: vi.fn(),
}));

import { getProjectRoles, getSkills } from "../../../../../src/services/teamManagementService";

const skill = {
  id: "skill-1",
  name: "React",
  roleIds: ["role-1"],
  status: "ACTIVE" as const,
  category: "Engineering",
  universal: false,
};
const role = { id: "role-1", name: "Frontend", description: "" };

describe("useSkillPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts idle and loads skills and roles together on demand", async () => {
    vi.mocked(getSkills).mockResolvedValue([skill]);
    vi.mocked(getProjectRoles).mockResolvedValue([role]);

    const { result } = renderHook(() => useSkillPool());

    expect(result.current.loadingState).toBe("idle");

    await act(async () => {
      await result.current.loadSkillPool();
    });

    expect(result.current.loadingState).toBe("success");
    expect(result.current.skills).toEqual([skill]);
    expect(result.current.roles).toEqual([role]);
  });

  it("does not refetch on a second call unless forced", async () => {
    vi.mocked(getSkills).mockResolvedValue([skill]);
    vi.mocked(getProjectRoles).mockResolvedValue([role]);

    const { result } = renderHook(() => useSkillPool());

    await act(async () => {
      await result.current.loadSkillPool();
    });
    await act(async () => {
      await result.current.loadSkillPool();
    });

    expect(getSkills).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.loadSkillPool(true);
    });

    expect(getSkills).toHaveBeenCalledTimes(2);
  });

  it("surfaces an error message when loading fails", async () => {
    vi.mocked(getSkills).mockRejectedValue(new Error("Network down"));
    vi.mocked(getProjectRoles).mockResolvedValue([]);

    const { result } = renderHook(() => useSkillPool());

    await act(async () => {
      await result.current.loadSkillPool();
    });

    await waitFor(() => expect(result.current.loadingState).toBe("error"));
    expect(result.current.errorMessage).toBe("Network down");
  });

  it("upsertSkill inserts a new skill and replaces an existing one by id", async () => {
    vi.mocked(getSkills).mockResolvedValue([skill]);
    vi.mocked(getProjectRoles).mockResolvedValue([role]);

    const { result } = renderHook(() => useSkillPool());

    await act(async () => {
      await result.current.loadSkillPool();
    });

    act(() => {
      result.current.upsertSkill({ ...skill, name: "React (renamed)" });
    });
    expect(result.current.skills).toEqual([{ ...skill, name: "React (renamed)" }]);

    act(() => {
      result.current.upsertSkill({ ...skill, id: "skill-2", name: "Vue" });
    });
    expect(result.current.skills.map((entry) => entry.name)).toEqual(["React (renamed)", "Vue"]);
  });
});
