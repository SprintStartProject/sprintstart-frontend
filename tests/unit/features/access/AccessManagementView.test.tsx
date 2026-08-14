import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import {
  AccessManagementView,
  DEFAULT_ACCESS_SOURCE_FILTER,
} from "../../../../src/features/access/components/AccessManagementView";
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

/**
 * The filter is owned by whoever hosts the view, so that it survives the admin
 * page unmounting the section on a tab switch. This stands in for that host.
 */
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
        <ViewHost />
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

  it("lists every source in use in one view instead of one tab per source", async () => {
    renderView();

    // Visibility rather than presence: a filtered-out source stays mounted, so
    // its rows are in the DOM either way.
    await waitFor(() => expect(screen.getByTestId("access-group-github")).toBeVisible());
    await waitFor(() => expect(screen.getByTestId("access-group-jira")).toBeVisible());
    expect(screen.getByText("gh-default")).toBeInTheDocument();
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

  it("offers the two cross-source filters plus one option per connector", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "In use",
      "All sources",
      ...ACCESS_CONNECTORS.map((connector) => connector.label),
    ]);
  });

  it("hides a source with no credentials by default and reveals it under All sources", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    await waitFor(() => expect(screen.getByTestId("access-group-github")).toBeVisible());
    expect(screen.getByTestId("access-group-jira")).not.toBeVisible();

    await selectSource(user, "All sources");

    await waitFor(() => expect(screen.getByTestId("access-group-jira")).toBeVisible());
    expect(screen.getByText("No credentials yet")).toBeVisible();
  });

  it("keeps loading every source while unused ones are hidden", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    // The filter can only know which sources are in use because the hidden
    // ones are still mounted and still fetch.
    await waitFor(() => expect(getMyJiraCredentials).toHaveBeenCalled());
  });

  it("narrows the list to a single source and back", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => expect(screen.getByText("gh-default")).toBeInTheDocument());

    await selectSource(user, "Jira");
    await waitFor(() => expect(screen.getByTestId("access-group-github")).not.toBeVisible());
    expect(screen.getByTestId("access-group-jira")).toBeVisible();

    await selectSource(user, "All sources");
    await waitFor(() => expect(screen.getByTestId("access-group-github")).toBeVisible());
    expect(screen.getByTestId("access-group-jira")).toBeVisible();
  });

  it("adds to a hidden source through the global add button", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    await waitFor(() => expect(screen.getByTestId("access-group-jira")).not.toBeVisible());

    await user.click(screen.getByTestId("access-add-open"));
    await user.click(await screen.findByTestId("access-add-source-jira"));

    // Choosing a source reveals it and opens its form, even though it holds
    // nothing and the default filter had hidden it.
    await waitFor(() => expect(screen.getByTestId("access-group-jira")).toBeVisible());
    expect(screen.getByTestId("settings-jira-add-email")).toBeVisible();
  });

  it("takes the filter from its host instead of owning it", async () => {
    const user = userEvent.setup();
    const onSourceFilterChange = vi.fn();

    // Pinned to a fixed prop with no host state behind it: a view that kept the
    // filter internally would switch anyway and pass this test's first half,
    // but would then quietly reset whenever the admin page unmounts the
    // section on a tab switch.
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AccessManagementView sourceFilter="github" onSourceFilterChange={onSourceFilterChange} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("access-group-jira")).not.toBeVisible());
    expect(screen.getByTestId("access-group-github")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Filter access by source" }));
    await user.click(await screen.findByRole("option", { name: "Jira" }));

    expect(onSourceFilterChange).toHaveBeenCalledWith("jira");
    expect(screen.getByTestId("access-group-jira")).not.toBeVisible();
  });

  it("leaves the filter where the user put it and hides the source again on cancel", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    await waitFor(() => expect(screen.getByTestId("access-group-jira")).not.toBeVisible());

    await user.click(screen.getByTestId("access-add-open"));
    await user.click(await screen.findByTestId("access-add-source-jira"));
    await waitFor(() => expect(screen.getByTestId("access-group-jira")).toBeVisible());

    // Revealing a source for the add form must not rewrite the filter.
    expect(screen.getByRole("combobox", { name: "Filter access by source" })).toHaveTextContent(
      "In use",
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByTestId("access-group-jira")).not.toBeVisible());
    expect(screen.getByRole("combobox", { name: "Filter access by source" })).toHaveTextContent(
      "In use",
    );
  });

  it("closes the add menu without choosing a source", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByTestId("access-add-open"));
    expect(await screen.findByTestId("access-add-source-jira")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByTestId("access-add-source-jira")).not.toBeInTheDocument(),
    );
  });

  it("explains the empty view when no source is set up at all", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValue([]);
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText("No source is set up yet")).toBeVisible();
    expect(screen.getByTestId("access-group-github")).not.toBeVisible();
    expect(screen.getByTestId("access-group-jira")).not.toBeVisible();
  });
});
