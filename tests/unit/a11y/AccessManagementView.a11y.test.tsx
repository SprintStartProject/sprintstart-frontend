import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/context/ThemeProvider";
import { AccessManagementView } from "../../../src/features/access/components/AccessManagementView";

vi.mock("../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn(),
  addGithubPat: vi.fn(),
  updateGithubPat: vi.fn(),
  deleteGithubPat: vi.fn(),
}));

vi.mock("../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
  addJiraCredential: vi.fn(),
  changeJiraCredentialName: vi.fn(),
  changeJiraCredentialToken: vi.fn(),
  deleteJiraCredential: vi.fn(),
}));

import { useAuth } from "../../../src/context/useAuth";
import { getGithubPatNames } from "../../../src/services/sources/githubService";
import { getMyJiraCredentials } from "../../../src/services/sources/jiraService";

describe("AccessManagementView Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      profile: { email: "user@corp.com" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("has no axe violations in empty, populated and add states", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames).mockResolvedValue([]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    const { baseElement } = render(
      <MemoryRouter>
        <ThemeProvider>
          <main>
            <AccessManagementView />
          </main>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("No tokens yet")).toBeInTheDocument());
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByTestId("access-add-open-github"));
    expect(screen.getByLabelText("Token name")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByTestId("access-add-open-jira"));
    expect(screen.getByTestId("settings-jira-add-email")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations with the source filter open", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames).mockResolvedValue(["gh-default"]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      { userEmail: "user@corp.com", displayName: "jira-default" },
    ]);

    const { baseElement } = render(
      <MemoryRouter>
        <ThemeProvider>
          <main>
            <AccessManagementView />
          </main>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));
    expect(await screen.findByRole("option", { name: "Jira" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
