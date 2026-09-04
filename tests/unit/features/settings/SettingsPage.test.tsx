import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { SettingsPage } from "../../../../src/pages/SettingsPage";
import { PermissionGroup } from "../../../../src/services/types";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";

vi.mock("../../../../src/features/profile/useProfile", () => ({
  useProfile: () => ({
    profile: {
      id: "1",
      authId: "a1",
      username: "testuser",
      email: "t@t.com",
      firstName: "Test",
      lastName: "User",
      projectRoles: [],
      projectIds: [],
      permissionGroup: "ADMIN",
      enabled: true,
      profileIcon: null,
      hasCompletedOnboarding: true,
    },
    isLoading: false,
    error: null,
    updateProfile: vi.fn(),
  }),
}));

vi.mock("../../../../src/features/settings/hooks/useGithubTokens", () => ({
  useGithubTokens: () => ({
    tokenNames: ["default"],
    tokensLoaded: true,
    tokensError: null,
    loadTokenNames: vi.fn(),
    isRefreshing: false,
  }),
}));

// The Moments section reads the celebratory layer, which lives behind its own
// provider. This test is about which sections a permission group sees, not
// about the rocket pet, so the hook is stubbed rather than the whole provider
// mounted — same as the onboarding page tests do.
vi.mock("../../../../src/features/moments", () => ({
  useMoments: () => ({
    showRocketPet: false,
    setShowRocketPet: vi.fn(),
  }),
}));

function mockAuth(group: PermissionGroup) {
  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: "1",
      authId: "a1",
      username: "testuser",
      email: "t@t.com",
      firstName: "Test",
      lastName: "User",
      projectRoles: [],
      projectIds: [],
      permissionGroup: group,
      enabled: true,
      profileIcon: null,
      hasCompletedOnboarding: true,
    },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
    refetchProfile: vi.fn(),
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all sections including Access Tokens for ADMIN", () => {
    mockAuth(PermissionGroup.ADMIN);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("User Profile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Appearance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Moments").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Access Tokens").length).toBeGreaterThan(0);
  });

  it("shows the PAT section for PM", async () => {
    mockAuth(PermissionGroup.PM);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Access Tokens").length).toBeGreaterThan(0));
  });

  it("hides the PAT section for USER", () => {
    mockAuth(PermissionGroup.USER);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("User Profile").length).toBeGreaterThan(0);
    expect(screen.queryByText("Access Tokens")).not.toBeInTheDocument();
  });
});
