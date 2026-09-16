import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  OnboardingJourneyContext,
  type OnboardingJourneyValue,
} from "../../../../src/features/onboarding/generation/OnboardingJourneyContext";
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

  it("is left out when there is no path and nothing to build one from", () => {
    const journey = (availability: OnboardingJourneyValue["availability"]) =>
      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <OnboardingJourneyContext.Provider
            value={{
              generation: { status: "idle" },
              startGeneration: vi.fn(),
              clearGeneration: vi.fn(),
              availability,
              unavailableReason: availability === "unavailable" ? "no-content" : null,
              refreshAvailability: vi.fn(),
            }}
          >
            {children}
          </OnboardingJourneyContext.Provider>
        );
      };

    expect(
      renderHook(() => useOnboardingAvailable(), { wrapper: journey("unavailable") }).result
        .current,
    ).toBe(false);
    expect(
      renderHook(() => useOnboardingAvailable(), { wrapper: journey("buildable") }).result.current,
    ).toBe(true);
    // Still unknown: keep the entry rather than blink it out and back in.
    expect(
      renderHook(() => useOnboardingAvailable(), { wrapper: journey("loading") }).result.current,
    ).toBe(true);
  });
});
