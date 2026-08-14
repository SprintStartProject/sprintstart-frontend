import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { AccessConnectorGroup } from "../../../../src/features/access/components/AccessConnectorGroup";
import { githubConnector } from "../../../../src/features/access/registry";

vi.mock("../../../../src/services/sources/githubService", () => ({
  getGithubPatNames: vi.fn(),
  addGithubPat: vi.fn(),
  updateGithubPat: vi.fn(),
  deleteGithubPat: vi.fn(),
}));

import {
  addGithubPat,
  deleteGithubPat,
  getGithubPatNames,
  updateGithubPat,
} from "../../../../src/services/sources/githubService";
import { ApiError } from "../../../../src/services/apiClient";

function renderGroup() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AccessConnectorGroup connector={githubConnector} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("AccessConnectorGroup — GitHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGithubPatNames).mockResolvedValue(["default"]);
    vi.mocked(addGithubPat).mockResolvedValue(undefined);
    vi.mocked(updateGithubPat).mockResolvedValue(undefined);
    vi.mocked(deleteGithubPat).mockResolvedValue(undefined);
  });

  it("renders the list of token names on mount", async () => {
    renderGroup();

    await waitFor(() => {
      expect(screen.getByText("default")).toBeInTheDocument();
    });
    expect(screen.getByText("1 token")).toBeInTheDocument();
  });

  it("shows the empty state when there are no tokens", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValue([]);

    renderGroup();

    await waitFor(() => {
      expect(screen.getByText("No tokens yet")).toBeInTheDocument();
    });
  });

  it("surfaces a server error in the error banner", async () => {
    vi.mocked(getGithubPatNames).mockRejectedValue(new Error("Server 500"));

    renderGroup();

    await waitFor(() => {
      expect(screen.getByTestId("access-error-github")).toHaveTextContent("Server 500");
    });
  });

  it("adds a token with a valid PAT and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames)
      .mockResolvedValueOnce(["default"])
      .mockResolvedValueOnce(["default", "ci"]);

    renderGroup();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("access-add-open-github"));
    await user.type(screen.getByTestId("settings-add-token-name"), "ci");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_aBcDef123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(addGithubPat).toHaveBeenCalledWith("ci", "ghp_aBcDef123"));
    await waitFor(() => expect(screen.getByText("2 tokens")).toBeInTheDocument());
  });

  it("rejects an invalid PAT format client-side without calling the API", async () => {
    const user = userEvent.setup();

    renderGroup();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("access-add-open-github"));
    await user.type(screen.getByTestId("settings-add-token-name"), "bad");
    await user.type(screen.getByTestId("settings-add-token-value"), "not-a-pat");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(screen.getByText(/Invalid token format/)).toBeInTheDocument());
    expect(addGithubPat).not.toHaveBeenCalled();
  });

  it("surfaces a mutation error from the server", async () => {
    const user = userEvent.setup();
    vi.mocked(addGithubPat).mockRejectedValue(
      new ApiError(409, '{"message":"Name already exists"}'),
    );

    renderGroup();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("access-add-open-github"));
    await user.type(screen.getByTestId("settings-add-token-name"), "default");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_abc123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(screen.getByText("Name already exists")).toBeInTheDocument());
  });

  it("deletes a token after confirmation and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames).mockResolvedValueOnce(["default"]).mockResolvedValueOnce([]);

    renderGroup();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-delete-open-default"));
    await user.click(screen.getByTestId("settings-delete-confirm-default"));

    await waitFor(() => expect(deleteGithubPat).toHaveBeenCalledWith("default"));
    await waitFor(() => expect(screen.getByText("No tokens yet")).toBeInTheDocument());
  });

  it("rotates a token with a valid PAT", async () => {
    const user = userEvent.setup();

    renderGroup();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-rotate-open-default"));
    await user.type(screen.getByTestId("settings-rotate-token-default"), "github_pat_newvalue123");
    await user.click(screen.getByTestId("settings-rotate-submit-default"));

    await waitFor(() =>
      expect(updateGithubPat).toHaveBeenCalledWith("default", "github_pat_newvalue123"),
    );
  });

  it("marks the group aria-busy while refreshing", async () => {
    let resolveRefresh: (v: string[]) => void = () => {};
    vi.mocked(getGithubPatNames).mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    renderGroup();

    await waitFor(() =>
      expect(screen.getByLabelText("GitHub access")).toHaveAttribute("aria-busy", "true"),
    );

    resolveRefresh(["default"]);
    await waitFor(() =>
      expect(screen.getByLabelText("GitHub access")).toHaveAttribute("aria-busy", "false"),
    );
  });
});
