import { render, type RenderOptions } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/context/ThemeProvider";
import { PermissionGroup, type UserProfile } from "../../../src/services/types";

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", ...renderOptions }: CustomRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider>{children}</ThemeProvider>
      </MemoryRouter>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export function createMockProfile(
  permissionGroup: PermissionGroup = PermissionGroup.USER,
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: "123",
    authId: "auth-123",
    username: "testuser",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    projectRoles: [],
    projectIds: [],
    permissionGroup,
    enabled: true,
    profileIcon: null,
    hasCompletedOnboarding: true,
    ...overrides,
  };
}

export { render } from "@testing-library/react";
