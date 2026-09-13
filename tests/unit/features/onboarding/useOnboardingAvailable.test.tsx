import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOnboardingAvailable } from "../../../../src/features/onboarding/hooks/useOnboardingAvailable";
import { PermissionGroup } from "../../../../src/services/types";
import type { UserProfile } from "../../../../src/services/types";

const mockAuth = vi.hoisted(() => ({
  value: { profile: null as UserProfile | null },
}));

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: () => mockAuth.value,
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
  });

  it("is available while onboarding is incomplete", () => {
    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(true);
  });

  it("is available without a role or path so personalization can be started manually", () => {
    mockAuth.value = {
      profile: { ...profileWithRole(), projectRoles: [] },
    };

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(true);
  });

  it("is unavailable once onboarding has been completed", () => {
    mockAuth.value = {
      profile: { ...profileWithRole(), hasCompletedOnboarding: true },
    };

    const { result } = renderHook(() => useOnboardingAvailable());

    expect(result.current).toBe(false);
  });
});
