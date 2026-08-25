import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/context/ThemeProvider";
import { SettingsPage } from "../../../src/pages/SettingsPage";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: () => ({
    profile: {
      id: "1",
      username: "testuser",
      firstName: "Test",
      lastName: "User",
      email: "test@test.com",
      projectRoles: [],
      projectIds: [],
      permissionGroup: "USER",
      enabled: true,
      profileIcon: null,
      hasCompletedOnboarding: true,
    },
  }),
}));

// The Moments section reads the celebratory layer, which lives behind its own
// provider. Stubbed rather than mounted: the toggle's markup is what axe needs
// to see, and the real provider would drag the overlays and the boot-splash
// hand-over into a page that is not being tested for either.
vi.mock("../../../src/features/moments", () => ({
  useMoments: () => ({
    showRocketPet: false,
    setShowRocketPet: vi.fn(),
  }),
}));

describe("SettingsPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
