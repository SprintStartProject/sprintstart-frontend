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
  getJiraCredentialsOfUser: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";
import { getJiraCredentialsOfUser } from "../../../../src/services/sources/jiraService";

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
    vi.mocked(getJiraCredentialsOfUser).mockResolvedValue([]);
    mockAuthEmail("user@corp.com");
  });

  it("shows the GitHub provider by default", () => {
    renderShell();

    expect(screen.getByLabelText("GitHub access tokens")).toBeInTheDocument();
    expect(screen.queryByLabelText("Jira credentials")).not.toBeInTheDocument();
  });

  it("switches to the Jira provider and back", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("access-tokens-segment-jira"));

    await waitFor(() =>
      expect(screen.getByLabelText("Jira credentials")).toBeInTheDocument(),
    );
    expect(getJiraCredentialsOfUser).toHaveBeenCalledWith(
      "user@corp.com",
      expect.any(AbortSignal),
    );
    expect(
      screen.queryByLabelText("GitHub access tokens"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("access-tokens-segment-github"));
    expect(screen.getByLabelText("GitHub access tokens")).toBeInTheDocument();
  });

  it("passes null email through to the Jira notice when the profile has none", async () => {
    const user = userEvent.setup();
    mockAuthEmail(null);
    renderShell();

    await user.click(screen.getByTestId("access-tokens-segment-jira"));

    expect(screen.getByTestId("settings-jira-no-email")).toBeInTheDocument();
    expect(getJiraCredentialsOfUser).not.toHaveBeenCalled();
  });
});
