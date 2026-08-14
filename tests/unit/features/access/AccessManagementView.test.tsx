import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessManagementView } from "../../../../src/features/access/components/AccessManagementView";
import { ACCESS_CONNECTORS } from "../../../../src/features/access/registry";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn(),
  addGithubPat: vi.fn(),
  updateGithubPat: vi.fn(),
  deleteGithubPat: vi.fn(),
}));

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
  addJiraCredential: vi.fn(),
  changeJiraCredentialName: vi.fn(),
  changeJiraCredentialToken: vi.fn(),
  deleteJiraCredential: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";
import { getGithubPatNames } from "../../../../src/services/sources/githubService";
import { getMyJiraCredentials } from "../../../../src/services/sources/jiraService";

function renderView() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AccessManagementView />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

async function selectSource(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("AccessManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      profile: { email: "user@corp.com" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(getGithubPatNames).mockResolvedValue(["gh-default"]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      { userEmail: "user@corp.com", displayName: "jira-default" },
    ]);
  });

  it("lists every source in one view instead of one tab per source", async () => {
    renderView();

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());
    expect(screen.getByText("jira-default")).toBeInTheDocument();

    // Both sources fetched without anyone switching to them.
    expect(getGithubPatNames).toHaveBeenCalled();
    expect(getMyJiraCredentials).toHaveBeenCalled();
  });

  it("renders one group per registered connector, in registry order", async () => {
    renderView();

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());

    const groups = screen.getAllByTestId(/^access-group-/);
    expect(groups.map((group) => group.getAttribute("data-testid"))).toEqual(
      ACCESS_CONNECTORS.map((connector) => `access-group-${connector.id}`),
    );
  });

  it("offers one filter option per connector plus 'All sources'", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "All sources",
      ...ACCESS_CONNECTORS.map((connector) => connector.label),
    ]);
  });

  it("narrows the list to a single source and back", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());

    await selectSource(user, "Jira");
    await waitFor(() =>
      expect(screen.queryByTestId("access-group-github")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("access-group-jira")).toBeInTheDocument();

    await selectSource(user, "All sources");
    await waitFor(() => expect(screen.getByTestId("access-group-github")).toBeInTheDocument());
    expect(screen.getByTestId("access-group-jira")).toBeInTheDocument();
  });

  it("still shows a source with nothing stored, so it can be set up", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    await waitFor(() => expect(screen.getByText("No credentials yet")).toBeInTheDocument());
    expect(screen.getByTestId("access-add-open-jira")).toBeInTheDocument();
  });
});
