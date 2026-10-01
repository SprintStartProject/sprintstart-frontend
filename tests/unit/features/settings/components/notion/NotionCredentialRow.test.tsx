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
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("NotionCredentialRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(changeNotionCredentialName).mockResolvedValue(undefined);
    vi.mocked(changeNotionCredentialToken).mockResolvedValue(undefined);
    vi.mocked(deleteNotionCredential).mockResolvedValue(undefined);
  });

  it("marks the rename and rotate fields as required", async () => {
    const user = userEvent.setup();
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByRole("button", { name: /rename credential/i }));
    expect(screen.getByLabelText(/^New name/)).toHaveAttribute("aria-required", "true");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(await screen.findByRole("button", { name: /rotate token/i }));
    expect(screen.getByLabelText(/^New integration token/)).toHaveAttribute(
      "aria-required",
      "true",
    );
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

  it("explains a 401 on rotate", async () => {
    const user = userEvent.setup();
    vi.mocked(changeNotionCredentialToken).mockRejectedValue(new ApiError(401, "bad"));
    render(<NotionCredentialRow credential={credential} onSaved={vi.fn(async () => {})} />);

    await user.click(screen.getByTestId("settings-notion-rotate-open-wiki"));
    await user.type(screen.getByTestId("settings-notion-rotate-input-wiki"), "nope");
    await user.click(screen.getByTestId("settings-notion-rotate-submit-wiki"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/rejected this token/i)),
    );
  });
});
