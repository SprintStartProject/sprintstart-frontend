import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotionCredentialRow } from "../../../../../../src/features/settings/components/notion/NotionCredentialRow.tsx";
import { ApiError } from "../../../../../../src/services/apiClient";

const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

vi.mock("../../../../../../src/context/useToast", () => ({
  useToast: () => toast,
}));

vi.mock("../../../../../../src/services/sources/notionService", () => ({
  changeNotionCredentialName: vi.fn(),
  changeNotionCredentialToken: vi.fn(),
  deleteNotionCredential: vi.fn(),
}));

import {
  changeNotionCredentialName,
  changeNotionCredentialToken,
  deleteNotionCredential,
} from "../../../../../../src/services/sources/notionService";

const credential = {
  name: "wiki",
  workspaceId: "ws-1" as string | null,
  workspaceName: "Acme Workspace" as string | null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("NotionCredentialRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(changeNotionCredentialName).mockResolvedValue(credential);
    vi.mocked(changeNotionCredentialToken).mockResolvedValue(credential);
    vi.mocked(deleteNotionCredential).mockResolvedValue(undefined);
  });

  it("shows the workspace the token belongs to", () => {
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    expect(screen.getByText(/Workspace Acme Workspace/)).toBeInTheDocument();
  });

  it("shows only the update date when Notion named no workspace", () => {
    render(
      <NotionCredentialRow
        credential={{ ...credential, workspaceId: null, workspaceName: null }}
        onSaved={vi.fn(async () => {})}
      />,
    );

    expect(screen.queryByText(/Workspace/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Updated /)).toBeInTheDocument();
  });

  it("marks the rename and rotate fields as required", async () => {
    const user = userEvent.setup();
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByRole("button", { name: /rename credential/i }));
    expect(screen.getByLabelText(/^New name/)).toHaveAttribute("aria-required", "true");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(await screen.findByRole("button", { name: /rotate token/i }));
    expect(screen.getByLabelText(/^New Notion token/)).toHaveAttribute("aria-required", "true");
  });

  it("renames the credential by old and new name and refreshes the list", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn(async () => {});
    render(<NotionCredentialRow credential={credential} onSaved={onSaved} />);

    await user.click(screen.getByTestId("settings-notion-rename-open-wiki"));
    const input = screen.getByTestId("settings-notion-rename-input-wiki");
    await user.clear(input);
    await user.type(input, "docs");
    await user.click(screen.getByTestId("settings-notion-rename-submit-wiki"));

    await waitFor(() =>
      expect(changeNotionCredentialName).toHaveBeenCalledWith({ oldName: "wiki", newName: "docs" }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Credential renamed");
  });

  it("rotates the token by credential name", async () => {
    const user = userEvent.setup();
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-rotate-open-wiki"));
    await user.type(screen.getByTestId("settings-notion-rotate-input-wiki"), "new-token");
    await user.click(screen.getByTestId("settings-notion-rotate-submit-wiki"));

    await waitFor(() =>
      expect(changeNotionCredentialToken).toHaveBeenCalledWith({
        name: "wiki",
        newToken: "new-token",
      }),
    );
  });

  it("deletes the credential after confirmation", async () => {
    const user = userEvent.setup();
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-delete-open-wiki"));
    await user.click(screen.getByTestId("settings-notion-delete-confirm-wiki"));

    await waitFor(() => expect(deleteNotionCredential).toHaveBeenCalledWith({ name: "wiki" }));
  });

  it("warns in the delete confirmation that a used credential cannot be deleted", async () => {
    const user = userEvent.setup();
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-delete-open-wiki"));

    expect(screen.getByText(/connected workspace still uses cannot be deleted/i)).toBeVisible();
  });

  it("explains a 409 on delete and keeps the panel open", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteNotionCredential).mockRejectedValue(new ApiError(409, "in use"));
    const onSaved = vi.fn(async () => {});
    render(<NotionCredentialRow credential={credential} onSaved={onSaved} />);

    await user.click(screen.getByTestId("settings-notion-delete-open-wiki"));
    await user.click(screen.getByTestId("settings-notion-delete-confirm-wiki"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Still used by a connected workspace. Remove it from its project first.",
      ),
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-notion-delete-confirm-wiki")).toBeInTheDocument();
  });

  it("explains a 409 on rename and keeps the panel open", async () => {
    const user = userEvent.setup();
    vi.mocked(changeNotionCredentialName).mockRejectedValue(new ApiError(409, "dup"));
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-rename-open-wiki"));
    await user.type(screen.getByTestId("settings-notion-rename-input-wiki"), "x");
    await user.click(screen.getByTestId("settings-notion-rename-submit-wiki"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already exists/i)),
    );
    expect(screen.getByTestId("settings-notion-rename-input-wiki")).toBeInTheDocument();
  });

  it("passes the server message through on a 422 on rotate", async () => {
    const user = userEvent.setup();
    vi.mocked(changeNotionCredentialToken).mockRejectedValue(
      new ApiError(422, "Notion rejected this token."),
    );
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-rotate-open-wiki"));
    await user.type(screen.getByTestId("settings-notion-rotate-input-wiki"), "nope");
    await user.click(screen.getByTestId("settings-notion-rotate-submit-wiki"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rejected this token/i)),
    );
  });
});
