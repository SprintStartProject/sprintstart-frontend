import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessConnectorGroup } from "../../../../src/features/access/components/AccessConnectorGroup";
import { atlassianConnector } from "../../../../src/features/access/registry";
import type { AtlassianCredentialDto } from "../../../../src/services/sources/atlassianService";

vi.mock("../../../../src/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../../src/services/sources/atlassianService", () => ({
  getMyAtlassianCredentials: vi.fn(),
  addAtlassianCredential: vi.fn(),
  changeAtlassianCredentialName: vi.fn(),
  changeAtlassianCredentialToken: vi.fn(),
  deleteAtlassianCredential: vi.fn(),
}));

import { useAuth } from "../../../../src/context/useAuth";
import {
  getMyAtlassianCredentials,
  addAtlassianCredential,
  changeAtlassianCredentialName,
  changeAtlassianCredentialToken,
  deleteAtlassianCredential,
} from "../../../../src/services/sources/atlassianService";

const EMAIL = "user@corp.com";
const cred = (displayName: string, userEmail = EMAIL): AtlassianCredentialDto => ({
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

/** Stable identity, so the group's report effect does not re-run every render. */
const noop = () => {};

/**
 * The add form's open state lives in the view, whose single "Add credential"
 * button drives any source — the group has no button of its own. This harness
 * stands in for that owner, with a plain trigger in its place.
 */
function GroupHarness() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsAddOpen(true)}>
        open add form
      </button>
      <AccessConnectorGroup
        connector={atlassianConnector}
        isHidden={false}
        isAddOpen={isAddOpen}
        onAddClose={() => setIsAddOpen(false)}
        onStateChange={noop}
      />
    </>
  );
}

function renderGroup() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <GroupHarness />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AccessConnectorGroup — Atlassian", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthEmail(EMAIL);
    vi.mocked(getMyAtlassianCredentials).mockResolvedValue([cred("default")]);
    vi.mocked(addAtlassianCredential).mockResolvedValue(undefined);
    vi.mocked(changeAtlassianCredentialName).mockResolvedValue(cred("renamed"));
    vi.mocked(changeAtlassianCredentialToken).mockResolvedValue(cred("default"));
    vi.mocked(deleteAtlassianCredential).mockResolvedValue(undefined);
  });

  it("renders all credentials with their Atlassian account emails", async () => {
    vi.mocked(getMyAtlassianCredentials).mockResolvedValue([
      cred("default"),
      cred("support", "support@corp.com"),
    ]);

    renderGroup();

    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    expect(screen.getByText("support@corp.com")).toBeInTheDocument();
    expect(screen.getByText("2 credentials")).toBeInTheDocument();
    expect(getMyAtlassianCredentials).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("keeps two credentials of the same name apart by Atlassian account", async () => {
    vi.mocked(getMyAtlassianCredentials).mockResolvedValue([
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
    expect(getMyAtlassianCredentials).toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole("button", { name: "open add form" }));
    expect(screen.getByTestId("settings-atlassian-add-email")).toHaveValue("");
  });

  it("shows the empty state when there are no credentials", async () => {
    vi.mocked(getMyAtlassianCredentials).mockResolvedValue([]);

    renderGroup();

    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });

  it("prefills the Atlassian email and adds a credential", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyAtlassianCredentials)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([cred("default"), cred("ci")]);

    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByRole("button", { name: "open add form" }));
    expect(screen.getByTestId("settings-atlassian-add-email")).toHaveValue(EMAIL);
    await user.type(screen.getByTestId("settings-atlassian-add-name"), "ci");
    await user.type(screen.getByTestId("settings-atlassian-add-token"), "secret-token");
    await user.click(screen.getByTestId("settings-atlassian-add-submit"));

    await waitFor(() =>
      expect(addAtlassianCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "ci",
        authToken: "secret-token",
      }),
    );
    expect(await screen.findByText("2 credentials")).toBeInTheDocument();
  });

  it("allows an Atlassian email different from the login email", async () => {
    const user = userEvent.setup();
    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByRole("button", { name: "open add form" }));
    const emailInput = screen.getByTestId("settings-atlassian-add-email");
    await user.clear(emailInput);
    await user.type(emailInput, "jira-account@atlassian.com");
    await user.type(screen.getByTestId("settings-atlassian-add-name"), "work");
    await user.type(screen.getByTestId("settings-atlassian-add-token"), "tok");
    await user.click(screen.getByTestId("settings-atlassian-add-submit"));

    await waitFor(() =>
      expect(addAtlassianCredential).toHaveBeenCalledWith({
        userEmail: "jira-account@atlassian.com",
        tokenName: "work",
        authToken: "tok",
      }),
    );
  });

  it("renames a credential using its stored Atlassian email", async () => {
    const user = userEvent.setup();
    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-atlassian-rename-open-default"));
    const input = screen.getByTestId("settings-atlassian-rename-input-default");
    await user.clear(input);
    await user.type(input, "renamed");
    await user.click(screen.getByTestId("settings-atlassian-rename-submit-default"));

    await waitFor(() =>
      expect(changeAtlassianCredentialName).toHaveBeenCalledWith({
        userEmail: EMAIL,
        oldName: "default",
        newName: "renamed",
      }),
    );
  });

  it("rotates a credential token using its stored Atlassian email", async () => {
    const user = userEvent.setup();
    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-atlassian-rotate-open-default"));
    await user.type(screen.getByTestId("settings-atlassian-rotate-input-default"), "new-token");
    await user.click(screen.getByTestId("settings-atlassian-rotate-submit-default"));

    await waitFor(() =>
      expect(changeAtlassianCredentialToken).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
        newToken: "new-token",
      }),
    );
  });

  it("deletes a credential using its stored Atlassian email and refreshes", async () => {
    const user = userEvent.setup();
    vi.mocked(getMyAtlassianCredentials)
      .mockResolvedValueOnce([cred("default")])
      .mockResolvedValueOnce([]);

    renderGroup();
    await screen.findByText("default");

    await user.click(screen.getByTestId("settings-atlassian-delete-open-default"));
    await user.click(screen.getByTestId("settings-atlassian-delete-confirm-default"));

    await waitFor(() =>
      expect(deleteAtlassianCredential).toHaveBeenCalledWith({
        userEmail: EMAIL,
        tokenName: "default",
      }),
    );
    expect(await screen.findByText("No credentials yet")).toBeInTheDocument();
  });
});
