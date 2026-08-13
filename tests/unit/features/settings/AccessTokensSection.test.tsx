import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessTokensSection } from "../../../../src/features/settings/components/AccessTokensSection";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../../src/features/settings/hooks/useGithubTokens", () => ({
  useGithubTokens: () => ({
    tokenNames: ["gh-default"],
    tokensLoaded: true,
    tokensError: null,
    loadTokenNames: vi.fn(),
    isRefreshing: false,
  }),
}));

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";
import { getMyJiraCredentials } from "../../../../src/services/sources/jiraService";

function mockAuthEmail(email: string | null) {
  vi.mocked(useAuth).mockReturnValue({
    profile: {
      id: "1",
      authId: "a1",
      username: "u",
      email,
      firstName: "U",
      lastName: "Ser",
      projectRoles: [],
      projectIds: [],
      permissionGroup: "ADMIN",
      enabled: true,
      profileIcon: null,
      hasCompletedOnboarding: true,
    },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
    refetchProfile: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function renderShell() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AccessTokensSection />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AccessTokensSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);
    mockAuthEmail("user@corp.com");
  });

  it("shows the GitHub provider by default", () => {
    renderShell();

    expect(screen.getByLabelText("GitHub access tokens")).toBeInTheDocument();
    expect(screen.queryByLabelText("Jira credentials")).not.toBeInTheDocument();
  });

  it("switches to Jira and loads the authenticated user's credentials", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("access-tokens-segment-jira"));

    await waitFor(() => expect(screen.getByLabelText("Jira credentials")).toBeInTheDocument());
    expect(getMyJiraCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));

    await user.click(screen.getByTestId("access-tokens-segment-github"));
    expect(screen.getByLabelText("GitHub access tokens")).toBeInTheDocument();
  });

  it("still loads Jira credentials without a profile email", async () => {
    const user = userEvent.setup();
    mockAuthEmail(null);
    renderShell();

    await user.click(screen.getByTestId("access-tokens-segment-jira"));

    await waitFor(() => expect(getMyJiraCredentials).toHaveBeenCalled());
    await user.click(screen.getByTestId("settings-jira-add-open"));
    expect(screen.getByTestId("settings-jira-add-email")).toHaveValue("");
  });
});
