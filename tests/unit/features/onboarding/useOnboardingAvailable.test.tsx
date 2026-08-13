import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOnboardingAvailable } from "../../../../src/features/onboarding/hooks/useOnboardingAvailable";
import { knowledgeService } from "../../../../src/services/knowledgeService";
import { PermissionGroup } from "../../../../src/services/types";
import type { UserProfile } from "../../../../src/services/types";

const mockAuth = vi.hoisted(() => ({
  value: { profile: null as UserProfile | null },
}));
const mockProject = vi.hoisted(() => ({
  value: { selectedProjectId: null as string | null },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => mockAuth.value,
}));

vi.mock("../../../../src/features/projects/useProjectContext", () => ({
  useProjectContext: () => mockProject.value,
}));

vi.mock("../../../../src/services/knowledgeService", () => ({
  knowledgeService: { hasIngestedContent: vi.fn() },
}));

const profileWithRole = (): UserProfile => ({
  id: "u1",
  authId: "auth-1",
  username: "testuser",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  projectRoles: [{ id: "role-1", name: "Backend Engineer" }],
  projectIds: ["p1"],
  permissionGroup: PermissionGroup.USER,
  enabled: true,
  profileIcon: null,
  hasCompletedOnboarding: false,
});

describe("useOnboardingAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.value = { profile: profileWithRole() };
    mockProject.value = { selectedProjectId: "p1" };
    vi.mocked(knowledgeService.hasIngestedContent).mockResolvedValue(true);
  });

  it("is available once a role is held and the project has content", async () => {
    const { result } = renderHook(() => useOnboardingAvailable());

    await waitFor(() => expect(knowledgeService.hasIngestedContent).toHaveBeenCalledWith("p1"));
    expect(result.current).toBe(true);
  });

  it("goes away when the project has nothing ingested to build a path from", async () => {
    vi.mocked(knowledgeService.hasIngestedContent).mockResolvedValue(false);

    const { result } = renderHook(() => useOnboardingAvailable());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("is unavailable without a role, and never asks about content", () => {
    mockAuth.value = {
      profile: { ...profileWithRole(), projectRoles: [] },
    };

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(false);
    expect(knowledgeService.hasIngestedContent).not.toHaveBeenCalled();
  });

  it("is unavailable once onboarding has been completed", () => {
    mockAuth.value = {
      profile: { ...profileWithRole(), hasCompletedOnboarding: true },
    };

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(false);
    expect(knowledgeService.hasIngestedContent).not.toHaveBeenCalled();
  });

  it("stays visible when the content check fails, rather than hiding navigation", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(knowledgeService.hasIngestedContent).mockRejectedValue(new Error("gateway down"));

    const { result } = renderHook(() => useOnboardingAvailable());

    await waitFor(() => expect(knowledgeService.hasIngestedContent).toHaveBeenCalled());
    // A blip must not look like the feature was taken away.
    expect(result.current).toBe(true);
  });

  it("stays visible while the answer is still in flight", () => {
    vi.mocked(knowledgeService.hasIngestedContent).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(true);
  });

  it("stays visible when no project is selected yet", () => {
    mockProject.value = { selectedProjectId: null };

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(true);
    expect(knowledgeService.hasIngestedContent).not.toHaveBeenCalled();
  });
});
