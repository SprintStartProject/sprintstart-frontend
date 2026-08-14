import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessConnectorGroup } from "../../../../src/features/access/components/AccessConnectorGroup";
import { jiraConnector } from "../../../../src/features/access/registry";
import type { JiraCredentialsDto } from "../../../../src/services/sources/jiraService";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../../src/services/sources/jiraService", () => ({
  getMyJiraCredentials: vi.fn(),
  addJiraCredential: vi.fn(),
  changeJiraCredentialName: vi.fn(),
  changeJiraCredentialToken: vi.fn(),
  deleteJiraCredential: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";
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

/**
 * The add form now takes its default email from the profile rather than a prop,
 * so the auth context has to be stubbed per case.
 */
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

function renderGroup() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AccessConnectorGroup connector={jiraConnector} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AccessConnectorGroup — Jira", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthEmail(EMAIL);
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

    renderGroup();

    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText("support@corp.com")).toBeInTheDocument();
    expect(screen.getByText("2 credentials")).toBeInTheDocument();
    expect(getMyJiraCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("keeps two credentials of the same name apart by Jira account", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([
      cred("default"),
      cred("default", "other@corp.com"),
    ]);

    renderGroup();

    expect(await screen.findByText("2 credentials")).toBeInTheDocument();
    expect(screen.getAllByText("default")).toHaveLength(2);
  });

  it("loads credentials even when the profile has no email", async () => {
    mockAuthEmail(null);
    renderGroup();

    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(getMyJiraCredentials).toHaveBeenCalled();

    await userEvent.setup().click(screen.getByTestId("access-add-open-jira"));
    expect(screen.getByTestId("settings-jira-add-email")).toHaveValue("");
  });

  it("shows the empty state when there are no credentials", async () => {
    vi.mocked(getMyJiraCredentials).mockResolvedValue([]);

    renderGroup();

    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });

  it("prefills the Jira email and adds a credential", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyJiraCredentials)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([cred("default"), cred("ci")]);

    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByTestId("access-add-open-jira"));
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
    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByTestId("access-add-open-jira"));
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
    renderGroup();
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
    renderGroup();
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

    renderGroup();
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
