import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/context/ThemeProvider";
import { ChatPreferencesProvider } from "../../../src/context/ChatPreferencesProvider";
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

describe("SettingsPage Accessibility", () => {
  it("should not have any a11y violations", async () => {
    const { baseElement } = render(
      <MemoryRouter>
        <ThemeProvider>
          <ChatPreferencesProvider>
            <SettingsPage />
          </ChatPreferencesProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
