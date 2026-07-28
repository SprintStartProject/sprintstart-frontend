import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { JiraCredentialsSection } from "../../../../src/features/settings/components/jira/JiraCredentialsSection";
import type { JiraCredentialsDto } from "../../../../src/services/sources/jiraService";

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getJiraCredentialsOfUser: vi.fn(),
  addJiraCredential: vi.fn(),
  changeJiraCredentialName: vi.fn(),
  changeJiraCredentialToken: vi.fn(),
  deleteJiraCredential: vi.fn(),
}));

import {
  getJiraCredentialsOfUser,
  addJiraCredential,
  changeJiraCredentialName,
  changeJiraCredentialToken,
  deleteJiraCredential,
} from "../../../../src/services/sources/jiraService";
import { ApiError } from "../../../../src/services/apiClient";

const EMAIL = "user@corp.com";
const cred = (displayName: string): JiraCredentialsDto => ({
  userEmail: EMAIL,
  displayName,
});

function renderSection(userEmail: string | null = EMAIL) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <JiraCredentialsSection userEmail={userEmail} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("JiraCredentialsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJiraCredentialsOfUser).mockResolvedValue([cred("default")]);
    vi.mocked(addJiraCredential).mockResolvedValue(undefined);
    vi.mocked(changeJiraCredentialName).mockResolvedValue(cred("renamed"));
    vi.mocked(changeJiraCredentialToken).mockResolvedValue(cred("default"));
    vi.mocked(deleteJiraCredential).mockResolvedValue(undefined);
  });

  it("renders the credential list with name and owner email on mount", async () => {
    renderSection();

    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );
    expect(screen.getByText("1 credential")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
  });

  it("shows the empty state when there are no credentials", async () => {
    vi.mocked(getJiraCredentialsOfUser).mockResolvedValue([]);

    renderSection();

    await waitFor(() =>
      expect(screen.getByText("No credentials yet")).toBeInTheDocument(),
    );
  });

  it("shows a notice and does not fetch when the profile has no email", () => {
    renderSection(null);

    expect(screen.getByTestId("settings-jira-no-email")).toBeInTheDocument();
    expect(getJiraCredentialsOfUser).not.toHaveBeenCalled();
  });

  it("adds a credential with the current user email and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(getJiraCredentialsOfUser)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([cred("default"), cred("ci")]);

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("settings-jira-add-open"));
    await user.type(screen.getByTestId("settings-jira-add-name"), "ci");
    await user.type(
      screen.getByTestId("settings-jira-add-token"),
      "secret-token",
    );
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(addJiraCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "ci",
        authToken: "secret-token",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("2 credentials")).toBeInTheDocument(),
    );
  });

  it("reloads for a different Jira account email when the scope is changed", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() =>
      expect(getJiraCredentialsOfUser).toHaveBeenCalledWith(
        EMAIL,
        expect.any(AbortSignal),
      ),
    );

    const emailInput = screen.getByTestId("settings-jira-account-email");
    await user.clear(emailInput);
    await user.type(emailInput, "jira-account@atlassian.com");
    await user.tab(); // blur commits the new scope

    await waitFor(() =>
      expect(getJiraCredentialsOfUser).toHaveBeenCalledWith(
        "jira-account@atlassian.com",
        expect.any(AbortSignal),
      ),
    );
  });

  it("adds a credential under the edited account email, not the login email", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

    const emailInput = screen.getByTestId("settings-jira-account-email");
    await user.clear(emailInput);
    await user.type(emailInput, "jira-account@atlassian.com");
    await user.tab();

    await user.click(screen.getByTestId("settings-jira-add-open"));
    await user.type(screen.getByTestId("settings-jira-add-name"), "ci");
    await user.type(screen.getByTestId("settings-jira-add-token"), "tok");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(addJiraCredential).toHaveBeenCalledWith({
        userEmail: "jira-account@atlassian.com",
        tokenName: "ci",
        authToken: "tok",
      }),
    );
  });

  it("surfaces a server error when adding a duplicate name", async () => {
    const user = userEvent.setup();
    vi.mocked(addJiraCredential).mockRejectedValue(
      new ApiError(400, '{"message":"Name already exists"}'),
    );

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("settings-jira-add-open"));
    await user.type(screen.getByTestId("settings-jira-add-name"), "default");
    await user.type(screen.getByTestId("settings-jira-add-token"), "tok");
    await user.click(screen.getByTestId("settings-jira-add-submit"));

    await waitFor(() =>
      expect(screen.getByText("Name already exists")).toBeInTheDocument(),
    );
  });

  it("renames a credential", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

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

  it("rotates a credential token", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("settings-jira-rotate-open-default"));
    await user.type(
      screen.getByTestId("settings-jira-rotate-input-default"),
      "new-token",
    );
    await user.click(screen.getByTestId("settings-jira-rotate-submit-default"));

    await waitFor(() =>
      expect(changeJiraCredentialToken).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
        newToken: "new-token",
      }),
    );
  });

  it("deletes a credential after confirmation and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(getJiraCredentialsOfUser)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([]);

    renderSection();
    await waitFor(() =>
      expect(screen.getByText("default")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("settings-jira-delete-open-default"));
    await user.click(
      screen.getByTestId("settings-jira-delete-confirm-default"),
    );

    await waitFor(() =>
      expect(deleteJiraCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("No credentials yet")).toBeInTheDocument(),
    );
  });
});
