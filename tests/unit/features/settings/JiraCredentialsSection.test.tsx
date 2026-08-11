import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { JiraCredentialsSection } from "../../../../src/features/settings/components/jira/JiraCredentialsSection";
import type { JiraCredentialsDto } from "../../../../src/services/sources/jiraService";

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
  addJiraCredential: vi.fn(),
  changeJiraCredentialName: vi.fn(),
  changeJiraCredentialToken: vi.fn(),
  deleteJiraCredential: vi.fn(),
}));

import {
  getMyJiraCredentials,
  addJiraCredential,
  changeJiraCredentialName,
  changeJiraCredentialToken,
  deleteJiraCredential,
} from "../../../../src/services/sources/jiraService";

const EMAIL = "user@corp.com";
const cred = (displayName: string, userEmail = EMAIL): JiraCredentialsDto => ({
  userEmail,
  displayName,
});

function renderSection(defaultUserEmail: string | null = EMAIL) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <JiraCredentialsSection defaultUserEmail={defaultUserEmail} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("JiraCredentialsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMyJiraCredentials).mockResolvedValue([cred("default")]);
    vi.mocked(addJiraCredential).mockResolvedValue(undefined);
    vi.mocked(changeJiraCredentialName).mockResolvedValue(cred("renamed"));
    vi.mocked(changeJiraCredentialToken).mockResolvedValue(cred("default"));
    vi.mocked(deleteJiraCredential).mockResolvedValue(undefined);
  });

  it("renders all credentials with their Jira account emails", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      cred("default"),
      cred("support", "support@corp.com"),
    ]);

    renderSection();

    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText("support@corp.com")).toBeInTheDocument();
    expect(screen.getByText("2 credentials")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh Jira credentials" }),
    ).not.toBeInTheDocument();
    expect(getMyJiraCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("loads credentials even when the profile has no email", async () => {
    renderSection(null);

    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(getMyJiraCredentials).toHaveBeenCalled();
  });

  it("shows the empty state when there are no credentials", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderSection();

    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });

  it("prefills the Jira email and adds a credential", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([cred("default"), cred("ci")]);

    renderSection();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-jira-add-open"));
    expect(screen.getByTestId("settings-jira-add-email")).toHaveValue(EMAIL);
    await user.type(screen.getByTestId("settings-jira-add-name"), "ci");
    await user.type(screen.getByTestId("settings-jira-add-token"), "secret-token");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(addJiraCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "ci",
        authToken: "secret-token",
      }),
    );
    expect(await screen.findByText("2 credentials")).toBeInTheDocument();
  });

  it("allows a Jira email different from the login email", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-jira-add-open"));
    const emailInput = screen.getByTestId("settings-jira-add-email");
    await user.clear(emailInput);
    await user.type(emailInput, "jira-account@atlassian.com");
    await user.type(screen.getByTestId("settings-jira-add-name"), "work");
    await user.type(screen.getByTestId("settings-jira-add-token"), "tok");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(addJiraCredential).toHaveBeenCalledWith({
        userEmail: "jira-account@atlassian.com",
        tokenName: "work",
        authToken: "tok",
      }),
    );
  });

  it("renames a credential using its stored Jira email", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-jira-rename-open-default"));
    const input = screen.getByTestId("settings-jira-rename-input-default");
    await user.clear(input);
    await user.type(input, "renamed");
    await user.click(screen.getByTestId("settings-jira-rename-submit-default"));

    await waitFor(() =>
      expect(changeJiraCredentialName).toHaveBeenCalledWith({
        userEmail: EMAIL,
        oldName: "default",
        newName: "renamed",
      }),
    );
  });

  it("rotates a credential token using its stored Jira email", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-jira-rotate-open-default"));
    await user.type(screen.getByTestId("settings-jira-rotate-input-default"), "new-token");
    await user.click(screen.getByTestId("settings-jira-rotate-submit-default"));

    await waitFor(() =>
      expect(changeJiraCredentialToken).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
        newToken: "new-token",
      }),
    );
  });

  it("deletes a credential using its stored Jira email and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([]);

    renderSection();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-jira-delete-open-default"));
    await user.click(screen.getByTestId("settings-jira-delete-confirm-default"));

    await waitFor(() =>
      expect(deleteJiraCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
      }),
    );
    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });
});
