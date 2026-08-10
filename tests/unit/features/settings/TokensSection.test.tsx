import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../../../src/context/ThemeProvider";
import { TokensSection } from "../../../../src/features/settings/components/TokensSection";

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

function renderSection() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <TokensSection />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("TokensSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGithubPatNames).mockResolvedValue(["default"]);
    vi.mocked(addGithubPat).mockResolvedValue(undefined);
    vi.mocked(updateGithubPat).mockResolvedValue(undefined);
    vi.mocked(deleteGithubPat).mockResolvedValue(undefined);
  });

  it("renders the list of token names on mount", async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText("default")).toBeInTheDocument();
    });
    expect(screen.getByText("1 token")).toBeInTheDocument();
  });

  it("shows the empty state when there are no tokens", async () => {
    vi.mocked(getGithubPatNames).mockResolvedValue([]);

    renderSection();

    await waitFor(() => {
      expect(screen.getByText("No tokens yet")).toBeInTheDocument();
    });
  });

  it("surfaces a server error in the error banner", async () => {
    vi.mocked(getGithubPatNames).mockRejectedValue(new Error("Server 500"));

    renderSection();

    await waitFor(() => {
      expect(screen.getByTestId("settings-tokens-error")).toHaveTextContent("Server 500");
    });
  });

  it("adds a token with a valid PAT and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames)
      .mockResolvedValueOnce(["default"])
      .mockResolvedValueOnce(["default", "ci"]);

    renderSection();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-add-token-open"));
    await user.type(screen.getByTestId("settings-add-token-name"), "ci");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_aBcDef123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(addGithubPat).toHaveBeenCalledWith("ci", "ghp_aBcDef123"));
    await waitFor(() => expect(screen.getByText("2 tokens")).toBeInTheDocument());
  });

  it("rejects an invalid PAT format client-side without calling the API", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-add-token-open"));
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

    renderSection();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-add-token-open"));
    await user.type(screen.getByTestId("settings-add-token-name"), "default");
    await user.type(screen.getByTestId("settings-add-token-value"), "ghp_abc123");
    await user.click(screen.getByTestId("settings-add-token-submit"));

    await waitFor(() => expect(screen.getByText("Name already exists")).toBeInTheDocument());
  });

  it("deletes a token after confirmation and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(getGithubPatNames).mockResolvedValueOnce(["default"]).mockResolvedValueOnce([]);

    renderSection();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-delete-open-default"));
    await user.click(screen.getByTestId("settings-delete-confirm-default"));

    await waitFor(() => expect(deleteGithubPat).toHaveBeenCalledWith("default"));
    await waitFor(() => expect(screen.getByText("No tokens yet")).toBeInTheDocument());
  });

  it("rotates a token with a valid PAT", async () => {
    const user = userEvent.setup();

    renderSection();
    await waitFor(() => expect(screen.getByText("default")).toBeInTheDocument());

    await user.click(screen.getByTestId("settings-rotate-open-default"));
    await user.type(screen.getByTestId("settings-rotate-token-default"), "github_pat_newvalue123");
    await user.click(screen.getByTestId("settings-rotate-submit-default"));

    await waitFor(() =>
      expect(updateGithubPat).toHaveBeenCalledWith("default", "github_pat_newvalue123"),
    );
  });

  it("marks the section aria-busy while refreshing", async () => {
    let resolveRefresh: (v: string[]) => void = () => {};
    vi.mocked(getGithubPatNames).mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    renderSection();

    await waitFor(() =>
      expect(screen.getByLabelText("GitHub access tokens")).toHaveAttribute("aria-busy", "true"),
    );

    resolveRefresh(["default"]);
    await waitFor(() =>
      expect(screen.getByLabelText("GitHub access tokens")).toHaveAttribute("aria-busy", "false"),
    );
  });
});
