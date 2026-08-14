import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../src/context/ThemeProvider";
import {
  AccessManagementView,
  DEFAULT_ACCESS_SOURCE_FILTER,
} from "../../../src/features/access/components/AccessManagementView";

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

function ViewHost() {
  const [sourceFilter, setSourceFilter] = useState<string>(DEFAULT_ACCESS_SOURCE_FILTER);

  return (
    <AccessManagementView sourceFilter={sourceFilter} onSourceFilterChange={setSourceFilter} />
  );
}

function renderView() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <main>
          <ViewHost />
        </main>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AccessManagementView Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      profile: { email: "user@corp.com" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("has no axe violations while listing sources, filtering and adding", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames).mockResolvedValue(["gh-default"]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      { userEmail: "user@corp.com", displayName: "jira-default" },
    ]);

    const { baseElement } = renderView();

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));
    expect(await screen.findByRole("option", { name: "Jira" })).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId("access-add-open"));
    expect(await screen.findByTestId("access-add-source-github")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();

    await user.click(screen.getByTestId("access-add-source-github"));
    expect(await screen.findByLabelText("Token name")).toBeInTheDocument();
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it("has no axe violations in the fully empty state", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValue([]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    const { baseElement } = renderView();

    await waitFor(() => expect(screen.getByText("No source is set up yet")).toBeInTheDocument());
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
